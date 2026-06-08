import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 8080);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined
    })
  : null;

app.use(express.json());

const tableExists = async (tableName) => {
  if (!pool) return false;
  const result = await pool.query("select to_regclass($1) as table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
};

const getDays = (value) => {
  const days = Number(value || 30);
  if (!Number.isFinite(days)) return 30;
  return Math.min(Math.max(Math.trunc(days), 1), 365);
};

const emptySummary = () => ({
  users: 0,
  sessions: 0,
  completedSessions: 0,
  answers: 0,
  avgAnswersPerSession: 0,
  recommendationEvents: 0,
  acceptedRecommendations: 0
});

const requireDb = (res) => {
  if (pool) return true;
  res.status(503).json({
    error: "DATABASE_URL is not configured",
    detail: "Set DATABASE_URL in Cloud Run or local env before using the dashboard API."
  });
  return false;
};

app.get("/api/health", async (_req, res) => {
  const hasDb = Boolean(pool);
  let connected = false;

  if (pool) {
    try {
      await pool.query("select 1");
      connected = true;
    } catch {
      connected = false;
    }
  }

  res.json({ ok: true, databaseConfigured: hasDb, databaseConnected: connected });
});

app.get("/api/summary", async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    const days = getDays(req.query.days);
    const summary = emptySummary();

    if (await tableExists("business.onboarding_voice_sessions")) {
      const result = await pool.query(
        `
          select
            count(distinct user_id)::int as users,
            count(*)::int as sessions,
            count(*) filter (where status = 'completed')::int as completed_sessions,
            coalesce(sum(jsonb_array_length(coalesce(answers, '[]'::jsonb))), 0)::int as answers,
            coalesce(avg(jsonb_array_length(coalesce(answers, '[]'::jsonb))), 0)::float as avg_answers_per_session
          from business.onboarding_voice_sessions
          where is_active = true
            and created_at >= now() - ($1::int * interval '1 day')
        `,
        [days]
      );
      Object.assign(summary, {
        users: result.rows[0].users,
        sessions: result.rows[0].sessions,
        completedSessions: result.rows[0].completed_sessions,
        answers: result.rows[0].answers,
        avgAnswersPerSession: Number(result.rows[0].avg_answers_per_session || 0)
      });
    }

    if (await tableExists("business.ai_recommendation_events")) {
      const result = await pool.query(
        `
          select
            count(*)::int as events,
            count(*) filter (where accepted = true)::int as accepted
          from business.ai_recommendation_events
          where created_at >= now() - ($1::int * interval '1 day')
        `,
        [days]
      );
      summary.recommendationEvents = result.rows[0].events;
      summary.acceptedRecommendations = result.rows[0].accepted;
    }

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    const days = getDays(req.query.days);
    const search = String(req.query.search || "").trim();

    if (!(await tableExists("business.onboarding_voice_sessions"))) {
      res.json([]);
      return;
    }

    const result = await pool.query(
      `
        select
          user_id::text as user_id,
          count(*)::int as sessions,
          count(distinct branch_id)::int as branches,
          count(*) filter (where status = 'completed')::int as completed_sessions,
          coalesce(sum(jsonb_array_length(coalesce(answers, '[]'::jsonb))), 0)::int as answers,
          coalesce(avg(jsonb_array_length(coalesce(answers, '[]'::jsonb))), 0)::float as avg_answers_per_session,
          max(updated_at) as last_activity_at
        from business.onboarding_voice_sessions
        where is_active = true
          and created_at >= now() - ($1::int * interval '1 day')
          and ($2::text = '' or user_id::text ilike '%' || $2::text || '%')
        group by user_id
        order by last_activity_at desc
        limit 100
      `,
      [days, search]
    );

    res.json(result.rows.map((row) => ({
      userId: row.user_id,
      sessions: row.sessions,
      branches: row.branches,
      completedSessions: row.completed_sessions,
      answers: row.answers,
      avgAnswersPerSession: Number(row.avg_answers_per_session || 0),
      lastActivityAt: row.last_activity_at
    })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId", async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    const userId = req.params.userId;

    if (!(await tableExists("business.onboarding_voice_sessions"))) {
      res.json({ sessions: [], blockMetrics: [], answers: [] });
      return;
    }

    const [sessions, blockMetrics, answers] = await Promise.all([
      pool.query(
        `
          select
            id::text,
            branch_id::text,
            status,
            current_question_index,
            jsonb_array_length(coalesce(answers, '[]'::jsonb))::int as answers_count,
            created_at,
            updated_at,
            completed_at
          from business.onboarding_voice_sessions
          where is_active = true and user_id::text = $1
          order by updated_at desc
          limit 50
        `,
        [userId]
      ),
      pool.query(
        `
          select
            coalesce(answer_item->>'block', 'sin_bloque') as block,
            count(*)::int as answers
          from business.onboarding_voice_sessions s
          cross join lateral jsonb_array_elements(coalesce(s.answers, '[]'::jsonb)) answer_item
          where s.is_active = true and s.user_id::text = $1
          group by block
          order by answers desc
        `,
        [userId]
      ),
      pool.query(
        `
          select
            s.id::text as session_id,
            s.branch_id::text as branch_id,
            answer_item->>'question_id' as question_id,
            answer_item->>'question' as question,
            answer_item->>'answer' as answer,
            answer_item->>'answer_source' as answer_source,
            answer_item->>'block' as block,
            coalesce((answer_item->>'order')::int, item_order::int) as item_order,
            s.updated_at
          from business.onboarding_voice_sessions s
          cross join lateral jsonb_array_elements(coalesce(s.answers, '[]'::jsonb)) with ordinality as a(answer_item, item_order)
          where s.is_active = true and s.user_id::text = $1
          order by s.updated_at desc, item_order desc
          limit 200
        `,
        [userId]
      )
    ]);

    res.json({
      sessions: sessions.rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id,
        status: row.status,
        currentQuestionIndex: row.current_question_index,
        answersCount: row.answers_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at
      })),
      blockMetrics: blockMetrics.rows.map((row) => ({ block: row.block, answers: row.answers })),
      answers: answers.rows.map((row) => ({
        sessionId: row.session_id,
        branchId: row.branch_id,
        questionId: row.question_id,
        question: row.question,
        answer: row.answer,
        answerSource: row.answer_source,
        block: row.block,
        order: row.item_order,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/answers", async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 80), 1), 200);

    if (!(await tableExists("business.onboarding_voice_sessions"))) {
      res.json([]);
      return;
    }

    const result = await pool.query(
      `
        select
          s.user_id::text as user_id,
          s.id::text as session_id,
          s.branch_id::text as branch_id,
          answer_item->>'question' as question,
          answer_item->>'answer' as answer,
          answer_item->>'answer_source' as answer_source,
          answer_item->>'block' as block,
          s.updated_at
        from business.onboarding_voice_sessions s
        cross join lateral jsonb_array_elements(coalesce(s.answers, '[]'::jsonb)) answer_item
        where s.is_active = true
        order by s.updated_at desc
        limit $1
      `,
      [limit]
    );

    res.json(result.rows.map((row) => ({
      userId: row.user_id,
      sessionId: row.session_id,
      branchId: row.branch_id,
      question: row.question,
      answer: row.answer,
      answerSource: row.answer_source,
      block: row.block,
      updatedAt: row.updated_at
    })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/recommendations", async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

    if (!(await tableExists("business.ai_recommendation_events"))) {
      res.json([]);
      return;
    }

    const result = await pool.query(
      `
        select
          id::text,
          branch_id::text,
          business_id,
          agent_id,
          conversation_id,
          recommendation_id,
          accepted,
          feedback,
          created_at
        from business.ai_recommendation_events
        order by created_at desc
        limit $1
      `,
      [limit]
    );

    res.json(result.rows.map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      businessId: row.business_id,
      agentId: row.agent_id,
      conversationId: row.conversation_id,
      recommendationId: row.recommendation_id,
      accepted: row.accepted,
      feedback: row.feedback,
      createdAt: row.created_at
    })));
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname, "..", "dist")));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "Internal server error",
    detail: process.env.NODE_ENV === "production" ? undefined : error.message
  });
});

app.listen(port, () => {
  console.log(`Agent responses dashboard listening on ${port}`);
});
