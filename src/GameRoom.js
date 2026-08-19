// GameRoom Durable Object — one per game PIN, WebSocket Hibernation API.
// Kahoot-style flow: lobby -> question -> reveal -> ... -> podium.

import { DurableObject } from 'cloudflare:workers';

const QUESTION_SECONDS = 20;

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
      } else {
        const name = (url.searchParams.get('name') || '').trim().slice(0, 20);
        if (!name) return new Response('Pseudo requis', { status: 400 });
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
      if (role !== 'host') await this.broadcastLobbyUpdate();
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
      if (msg.t === 'hostJoin' && game.phase === 'lobby') {
        // L'animateur joue aussi : il devient un joueur à part entière.
        const name = (String(msg.name || 'Animateur').trim().slice(0, 20)) || 'Animateur';
        const players = (await this.ctx.storage.get('players')) || {};
        if (!players[name.toLowerCase()]) {
          players[name.toLowerCase()] = { name, score: 0, answers: {} };
          await this.ctx.storage.put('players', players);
        }
        game.hostName = name;
        await this.ctx.storage.put('game', game);
        await this.broadcastLobbyUpdate();
        ws.send(JSON.stringify({ t: 'hostJoined', name }));
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
    const i = parseInt(rawIndex);
    const q = game.quiz.questions[qIdx];
    if (!Number.isInteger(i) || i < 0 || i >= q.options.length) return;
    const elapsed = now - game.qStart;
    const duration = game.qEnd - game.qStart;
    let points = 0;
    if (i === q.correct) {
      // Speed points + streak bonus (combo of consecutive correct answers)
      p.streak = (p.streak || 0) + 1;
      const speed = Math.round(500 + 500 * Math.max(0, 1 - elapsed / duration));
      const bonus = Math.min((p.streak - 1) * 50, 200);
      points = speed + bonus;
    } else {
      p.streak = 0;
    }
    p.answers[qIdx] = { i, points };
    p.score += points;
    players[name.toLowerCase()] = p;
    await this.ctx.storage.put('players', players);
    try { ws.send(JSON.stringify({ t: 'answered', i })); } catch {}

    // Notify host of answer count; auto-reveal when everyone answered
    const total = Object.keys(players).length;
    const answered = Object.values(players).filter((pl) => pl.answers[qIdx] !== undefined).length;
    this.broadcast({ t: 'answerCount', answered, total }, 'host');
    if (answered >= total) await this.reveal(game);
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
    // Room expiry: close everything and wipe storage
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
    for (const p of Object.values(players)) {
      const a = p.answers[fresh.currentQ];
      if (a) counts[a.i]++;
    }
    const leaderboard = this.leaderboard(players, fresh.currentQ);
    this.broadcast({
      t: 'reveal',
      idx: fresh.currentQ,
      total: fresh.quiz.questions.length,
      correct: q.correct,
      explanation: q.explanation || '',
      counts,
      leaderboard,
      isLast: fresh.currentQ >= fresh.quiz.questions.length - 1,
    });
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
        if (att.role === 'player' && att.name === winner.name) {
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

  async broadcastLobbyUpdate() {
    const game = await this.ctx.storage.get('game');
    const players = (await this.ctx.storage.get('players')) || {};
    if (!game) return;
    this.broadcast({
      t: 'lobby',
      phase: game.phase,
      title: game.quiz.title,
      players: Object.values(players).map((p) => p.name),
      maxPlayers: game.maxPlayers,
      total: game.quiz.questions.length,
    });
  }

  async sendStateTo(ws) {
    const game = await this.ctx.storage.get('game');
    const players = (await this.ctx.storage.get('players')) || {};
    if (!game) return;
    const base = {
      t: 'lobby',
      phase: game.phase,
      title: game.quiz.title,
      players: Object.values(players).map((p) => p.name),
      maxPlayers: game.maxPlayers,
      total: game.quiz.questions.length,
    };
    ws.send(JSON.stringify(base));
    if (game.phase === 'question') {
      const q = game.quiz.questions[game.currentQ];
      ws.send(JSON.stringify({
        t: 'question', idx: game.currentQ, total: game.quiz.questions.length,
        question: q.question, options: q.options, audioUrl: q.audioUrl || null,
        seconds: QUESTION_SECONDS, endsAt: game.qEnd,
      }));
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
