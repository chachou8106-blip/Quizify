// GameRoom Durable Object — one per game PIN, WebSocket Hibernation API.
// Kahoot-style flow: lobby -> question -> reveal -> ... -> podium.

import { DurableObject } from 'cloudflare:workers';

// 15 secondes : c'est le temps annoncé partout dans l'application. Le code
// tournait à 20, ce qui rendait la promesse fausse.
const QUESTION_SECONDS = 15;

// Une question à une seule option est une question « juste prix » : il n'y a
// pas de propositions à choisir, la bonne réponse est le nombre lui-même.
function estChiffree(q) {
  return Array.isArray(q?.options) && q.options.length === 1;
}

// Trouve un nom libre pour l'animateur. Un joueur a pu s'inscrire avant lui
// sous le même prénom (ou avoir récupéré le sien après une mise en retrait) :
// sans cela, ils partageraient une seule fiche et donc un seul score.
function nomLibre(players, souhaite) {
  const base = (String(souhaite || 'Animateur').trim().slice(0, 20)) || 'Animateur';
  const pris = (n) => players[n.toLowerCase()] && !players[n.toLowerCase()].anime;
  if (!pris(base)) return base;
  const suffixe = `${base.slice(0, 9)} (animateur)`;
  if (!pris(suffixe)) return suffixe;
  for (let i = 2; i < 50; i++) {
    const essai = `${base.slice(0, 16)} ${i}`;
    if (!pris(essai)) return essai;
  }
  return `${base.slice(0, 14)} ${Date.now() % 1000}`;
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/init') && request.method === 'POST') {
      const { quiz, hostKey, maxPlayers, rewardCode } = await request.json();
      await this.ctx.storage.put('game', {
        phase: 'lobby',
        quiz, // {title, questions:[{question, options, correct, explanation}]}
        currentQ: -1,
        qStart: 0,
        qEnd: 0,
        hostKey,
        maxPlayers: maxPlayers || 10,
        rewardCode: rewardCode || null,
        createdAt: Date.now(),
      });
      await this.ctx.storage.put('players', {});
      // Auto-cleanup after 6h
      await this.ctx.storage.put('expireLe', Date.now() + 6 * 3600 * 1000);
      await this.ctx.storage.setAlarm(Date.now() + 6 * 3600 * 1000);
      return Response.json({ ok: true });
    }

    if (url.pathname.endsWith('/status')) {
      const game = await this.ctx.storage.get('game');
      if (!game) return Response.json({ exists: false });
      const players = (await this.ctx.storage.get('players')) || {};
      return Response.json({
        exists: true,
        phase: game.phase,
        title: game.quiz.title,
        playerCount: Object.keys(players).length,
        maxPlayers: game.maxPlayers,
      });
    }

    if (url.pathname.endsWith('/ws')) {
      const game = await this.ctx.storage.get('game');
      if (!game) return new Response('Partie introuvable', { status: 404 });

      const role = url.searchParams.get('role');
      if (role === 'host') {
        if (url.searchParams.get('key') !== game.hostKey) return new Response('Interdit', { status: 403 });
        // L'animateur EST un joueur, par défaut et dès la connexion.
        //
        // Avant, il fallait cliquer « je joue aussi » : sa présence dans la
        // liste des joueurs était donc facultative et sa reconnexion la
        // perdait. C'est exactement ce qui produisait des comportements
        // différents entre lui et les autres (décompte des réponses, fin de
        // question, classement). Il est maintenant inscrit comme tout le
        // monde ; s'il préfère se contenter d'animer, il le dit explicitement
        // et on retient son choix (`spectateur`).
        if (!game.spectateur) {
          const brut = (url.searchParams.get('name') || '').trim().slice(0, 20);
          const players = (await this.ctx.storage.get('players')) || {};
          const nom = game.hostName || nomLibre(players, brut);
          if (!players[nom.toLowerCase()]) {
            players[nom.toLowerCase()] = { name: nom, score: 0, answers: {}, anime: true };
            await this.ctx.storage.put('players', players);
          }
          if (game.hostName !== nom) {
            game.hostName = nom;
            await this.ctx.storage.put('game', game);
          }
        }
      } else {
        const name = (url.searchParams.get('name') || '').trim().slice(0, 20);
        if (!name) return new Response('Pseudo requis', { status: 400 });
        // Le pseudo de l'animateur est réservé : sans cela, un joueur qui porte
        // le même prénom reprendrait sa fiche et ils partageraient un score.
        if (game.hostName && name.toLowerCase() === game.hostName.toLowerCase()) {
          return new Response("Ce prenom est deja pris par l'animateur, choisis-en un autre", { status: 409 });
        }
        const players = (await this.ctx.storage.get('players')) || {};
        const isReturning = !!players[name.toLowerCase()];
        if (!isReturning && Object.keys(players).length >= game.maxPlayers) {
          return new Response('Partie pleine', { status: 409 });
        }
        if (!isReturning) {
          players[name.toLowerCase()] = { name, score: 0, answers: {} };
          await this.ctx.storage.put('players', players);
        }
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({
        role: role === 'host' ? 'host' : 'player',
        name: role === 'host' ? null : (url.searchParams.get('name') || '').trim().slice(0, 20),
      });
      // Send current state to the newcomer right away
      await this.sendStateTo(server);
      // L'animateur compte parmi les joueurs : son arrivée aussi met la liste à jour.
      await this.broadcastLobbyUpdate();
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  // ---------- WebSocket handlers (hibernation-safe) ----------

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const att = ws.deserializeAttachment() || {};
    const game = await this.ctx.storage.get('game');
    if (!game) return;

    if (att.role === 'host') {
      // Reprendre sa place de joueur (après s'être mis en retrait, ou en cours
      // de partie). Autorisé à tout moment : il repart simplement de son score.
      if (msg.t === 'hostJoin') {
        const players = (await this.ctx.storage.get('players')) || {};
        const name = game.hostName || nomLibre(players, msg.name);
        if (!players[name.toLowerCase()]) {
          players[name.toLowerCase()] = { name, score: 0, answers: {}, anime: true };
          await this.ctx.storage.put('players', players);
        }
        game.hostName = name;
        game.spectateur = false;
        await this.ctx.storage.put('game', game);
        await this.broadcastLobbyUpdate();
        ws.send(JSON.stringify({ t: 'hostJoined', name }));
        return;
      }
      // Se mettre en retrait : il anime sans jouer. Sa fiche disparaît du
      // classement et du décompte des réponses.
      if (msg.t === 'hostLeave') {
        const players = (await this.ctx.storage.get('players')) || {};
        if (game.hostName) delete players[game.hostName.toLowerCase()];
        await this.ctx.storage.put('players', players);
        game.spectateur = true;
        game.hostName = null;
        await this.ctx.storage.put('game', game);
        await this.broadcastLobbyUpdate();
        ws.send(JSON.stringify({ t: 'hostLeft' }));
        return;
      }
      if (msg.t === 'answer' && game.hostName) {
        return this.recordAnswer(game, game.hostName, msg.i, ws);
      }
      if (msg.t === 'start' && game.phase === 'lobby') return this.startQuestion(game, 0);
      if (msg.t === 'next') {
        if (game.phase === 'question') return this.reveal(game);
        if (game.phase === 'reveal') {
          const next = game.currentQ + 1;
          if (next >= game.quiz.questions.length) return this.podium(game);
          return this.startQuestion(game, next);
        }
      }
      if (msg.t === 'end') return this.podium(game);
      return;
    }

    // Player answer
    if (msg.t === 'answer' && att.name) {
      return this.recordAnswer(game, att.name, msg.i, ws);
    }
  }

  async recordAnswer(game, name, rawIndex, ws) {
    if (game.phase !== 'question') return;
    const players = (await this.ctx.storage.get('players')) || {};
    const p = players[name.toLowerCase()];
    if (!p) return;
    const qIdx = game.currentQ;
    if (p.answers[qIdx] !== undefined) return; // already answered
    const now = Date.now();
    if (now > game.qEnd) return; // too late
    const q = game.quiz.questions[qIdx];
    const elapsed = now - game.qStart;
    const duration = game.qEnd - game.qStart;

    // « Le juste prix » : une seule option = la réponse est un nombre à deviner.
    // Personne ne peut être « juste » ou « faux » sur le coup : les points sont
    // attribués à la révélation, quand on connaît les propositions de tous.
    if (estChiffree(q)) {
      const valeur = Number(String(rawIndex).replace(',', '.'));
      if (!Number.isFinite(valeur)) return;
      p.answers[qIdx] = { guess: valeur, points: 0 };
      p.pendingGuess = true;
      players[name.toLowerCase()] = p;
      await this.ctx.storage.put('players', players);
      try { ws.send(JSON.stringify({ t: 'answered', guess: valeur })); } catch {}
      const tousLes = Object.keys(players).length;
      const ontRepondu = Object.values(players).filter((pl) => pl.answers[qIdx] !== undefined).length;
      this.broadcast({ t: 'answerCount', answered: ontRepondu, total: tousLes }, 'host');
      return;
    }

    const i = parseInt(rawIndex);
    if (!Number.isInteger(i) || i < 0 || i >= q.options.length) return;
    let points = 0;
    if (i === q.correct) {
      p.streak = (p.streak || 0) + 1;
      // Répartition 700 / 300 entre le savoir et la vitesse.
      //
      // Avant, la vitesse pesait pour moitié (500 + 500) : répondre juste au
      // bout de 15 secondes rapportait deux fois moins que répondre juste
      // instantanément. Dans une soirée de famille, cela revenait à classer les
      // grands-parents et les enfants par leur temps de réaction plutôt que par
      // ce qu'ils savent. La vitesse départage encore, mais ne domine plus.
      //
      // Les deux premières secondes ne sont pas décomptées : le temps de lire
      // la question ne doit pas être compté comme de l'hésitation.
      const reflexion = Math.max(0, elapsed - 2000);
      const utile = Math.max(1, duration - 2000);
      const vitesse = Math.round(300 * Math.max(0, 1 - reflexion / utile));
      const bonus = Math.min((p.streak - 1) * 50, 200);
      points = 700 + vitesse + bonus;
    } else {
      p.streak = 0;
    }
    p.answers[qIdx] = { i, points };
    p.score += points;
    players[name.toLowerCase()] = p;
    await this.ctx.storage.put('players', players);
    try { ws.send(JSON.stringify({ t: 'answered', i })); } catch {}

    // On informe l'animateur du décompte, SANS révéler automatiquement.
    //
    // L'ancien code révélait dès que « tous les joueurs enregistrés » avaient
    // répondu. Or l'animateur n'est compté parmi eux que s'il a cliqué « je joue
    // aussi ». À deux, si l'animateur ne jouait pas, le total valait 1 : la
    // première réponse mettait fin à la question sur-le-champ et coupait tout le
    // monde. C'est le chronomètre qui décide désormais, ou l'animateur avec son
    // bouton « Révéler ».
    const total = Object.keys(players).length;
    const answered = Object.values(players).filter((pl) => pl.answers[qIdx] !== undefined).length;
    this.broadcast({ t: 'answerCount', answered, total }, 'host');
  }

  async webSocketClose(ws) {
    try { ws.close(); } catch {}
    const att = ws.deserializeAttachment() || {};
    if (att.role === 'player') await this.broadcastLobbyUpdate();
  }

  async webSocketError(ws) {
    try { ws.close(); } catch {}
  }

  async alarm() {
    // L'alarme sert à deux choses : terminer une question dont le temps est
    // écoulé, et fermer la partie au bout de six heures.
    //
    // Le filet de sécurité sur la question compte : jusqu'ici, la fin du temps
    // était déclenchée par la page de l'animateur. Si son téléphone se met en
    // veille ou qu'il change d'onglet, la question restait figée indéfiniment.
    const game = await this.ctx.storage.get('game');
    if (game && game.phase === 'question' && Date.now() >= game.qEnd - 250) {
      await this.reveal(game);
      const expireLe = (await this.ctx.storage.get('expireLe')) || Date.now() + 6 * 3600 * 1000;
      await this.ctx.storage.setAlarm(expireLe);
      return;
    }

    const expireLe = await this.ctx.storage.get('expireLe');
    if (expireLe && Date.now() < expireLe - 250) {
      await this.ctx.storage.setAlarm(expireLe);
      return;
    }

    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(1000, 'Partie expirée'); } catch {}
    }
    await this.ctx.storage.deleteAll();
  }

  // ---------- Game flow ----------

  async startQuestion(game, idx) {
    const q = game.quiz.questions[idx];
    game.phase = 'question';
    game.currentQ = idx;
    game.qStart = Date.now();
    game.qEnd = game.qStart + QUESTION_SECONDS * 1000;
    await this.ctx.storage.put('game', game);
    // Filet de sécurité serveur : la question se terminera même si l'écran de
    // l'animateur est en veille.
    await this.ctx.storage.setAlarm(game.qEnd + 1500);
    this.broadcast({
      t: 'question',
      idx,
      total: game.quiz.questions.length,
      question: q.question,
      options: q.options,
      audioUrl: q.audioUrl || null,
      seconds: QUESTION_SECONDS,
      endsAt: game.qEnd,
    });
  }

  async reveal(game) {
    // Re-read to avoid double reveal
    const fresh = await this.ctx.storage.get('game');
    if (!fresh || fresh.phase !== 'question' || fresh.currentQ !== game.currentQ) return;
    fresh.phase = 'reveal';
    await this.ctx.storage.put('game', fresh);
    const players = (await this.ctx.storage.get('players')) || {};
    const q = fresh.quiz.questions[fresh.currentQ];
    const counts = q.options.map(() => 0);
    let propositions = null;

    if (estChiffree(q)) {
      // Classement par écart à la bonne réponse : le plus proche rafle la mise.
      const bonne = Number(q.options[0]);
      const liste = [];
      for (const [cle, p] of Object.entries(players)) {
        const a = p.answers[fresh.currentQ];
        if (!a || typeof a.guess !== 'number') { p.streak = 0; continue; }
        liste.push({ cle, nom: p.name, guess: a.guess, ecart: Math.abs(a.guess - bonne) });
      }
      liste.sort((x, y) => x.ecart - y.ecart);
      const BAREME = [1000, 700, 500, 350];
      liste.forEach((entree, rang) => {
        const p = players[entree.cle];
        // Tomber pile vaut un bonus : c'est le moment de gloire de la soirée.
        const exact = entree.ecart === 0;
        const pts = (BAREME[rang] ?? 200) + (exact ? 250 : 0);
        p.answers[fresh.currentQ].points = pts;
        p.score += pts;
        p.streak = rang === 0 ? (p.streak || 0) + 1 : 0;
        entree.points = pts;
        entree.exact = exact;
      });
      await this.ctx.storage.put('players', players);
      propositions = liste.map((e) => ({ name: e.nom, guess: e.guess, ecart: e.ecart, points: e.points, exact: e.exact }));
    } else {
      for (const p of Object.values(players)) {
        const a = p.answers[fresh.currentQ];
        if (a && Number.isInteger(a.i)) counts[a.i]++;
      }
    }

    const leaderboard = this.leaderboard(players, fresh.currentQ);
    const message = {
      t: 'reveal',
      idx: fresh.currentQ,
      total: fresh.quiz.questions.length,
      correct: q.correct,
      question: q.question,
      // Les propositions voyagent avec la révélation : l'écran reste juste même
      // pour qui se reconnecte à ce moment-là et n'a pas reçu la question.
      options: q.options,
      explanation: q.explanation || '',
      counts,
      propositions,
      bonneValeur: estChiffree(q) ? Number(q.options[0]) : null,
      leaderboard,
      isLast: fresh.currentQ >= fresh.quiz.questions.length - 1,
    };
    // Conservé pour pouvoir rejouer l'écran à qui se reconnecte pendant la
    // révélation (animateur comme joueur).
    await this.ctx.storage.put('lastReveal', message);
    this.broadcast(message);
  }

  async podium(game) {
    game.phase = 'podium';
    await this.ctx.storage.put('game', game);
    const players = (await this.ctx.storage.get('players')) || {};
    const leaderboard = this.leaderboard(players);
    this.broadcast({ t: 'podium', leaderboard, title: game.quiz.title });
    // Le vainqueur reçoit (en privé) son code cadeau : 3 quiz IA offerts.
    const winner = leaderboard[0];
    if (winner && game.rewardCode) {
      for (const ws of this.ctx.getWebSockets()) {
        const att = ws.deserializeAttachment() || {};
        // L'animateur qui joue gagne son cadeau comme les autres.
        const nom = att.role === 'host' ? game.hostName : att.name;
        if (nom && nom === winner.name) {
          try { ws.send(JSON.stringify({ t: 'reward', code: game.rewardCode, credits: 3 })); } catch {}
        }
      }
    }
  }

  leaderboard(players, qIdx = null) {
    return Object.values(players)
      .map((p) => ({
        name: p.name,
        score: p.score,
        streak: p.streak || 0,
        delta: qIdx !== null && p.answers[qIdx] ? p.answers[qIdx].points : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }

  etatLobby(game, players) {
    return {
      t: 'lobby',
      phase: game.phase,
      title: game.quiz.title,
      players: Object.values(players).map((p) => p.name),
      maxPlayers: game.maxPlayers,
      total: game.quiz.questions.length,
      // L'animateur retrouve son statut de joueur après un rechargement de page
      // ou une mise en veille du téléphone, au lieu de le perdre en silence.
      hostName: game.hostName || null,
    };
  }

  async broadcastLobbyUpdate() {
    const game = await this.ctx.storage.get('game');
    const players = (await this.ctx.storage.get('players')) || {};
    if (!game) return;
    this.broadcast(this.etatLobby(game, players));
  }

  async sendStateTo(ws) {
    const game = await this.ctx.storage.get('game');
    const players = (await this.ctx.storage.get('players')) || {};
    if (!game) return;
    ws.send(JSON.stringify(this.etatLobby(game, players)));

    // Toute reconnexion — animateur comme joueur — doit retomber sur l'écran en
    // cours. Auparavant, seule la phase « question » était rejouée : recharger
    // pendant une révélation renvoyait au salon d'attente.
    if (game.phase === 'question') {
      const q = game.quiz.questions[game.currentQ];
      ws.send(JSON.stringify({
        t: 'question', idx: game.currentQ, total: game.quiz.questions.length,
        question: q.question, options: q.options, audioUrl: q.audioUrl || null,
        seconds: QUESTION_SECONDS, endsAt: game.qEnd,
      }));
      // On lui rappelle ce qu'il avait déjà répondu, pour ne pas lui laisser
      // croire qu'il peut répondre une seconde fois.
      const att = ws.deserializeAttachment() || {};
      const nom = att.role === 'host' ? game.hostName : att.name;
      const moi = nom ? players[String(nom).toLowerCase()] : null;
      const a = moi?.answers?.[game.currentQ];
      if (a) ws.send(JSON.stringify({ t: 'answered', i: a.i, guess: a.guess }));
    } else if (game.phase === 'reveal') {
      const dernier = await this.ctx.storage.get('lastReveal');
      if (dernier) ws.send(JSON.stringify(dernier));
    } else if (game.phase === 'podium') {
      ws.send(JSON.stringify({ t: 'podium', leaderboard: this.leaderboard(players), title: game.quiz.title }));
    }
  }

  broadcast(msg, onlyRole = null) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() || {};
      if (onlyRole && att.role !== onlyRole) continue;
      try { ws.send(data); } catch {}
    }
  }
}
