import express from "express";
import crypto from "node:crypto";
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

const authSecret = process.env.DASHBOARD_AUTH_SECRET || process.env.DATABASE_URL || "local-dashboard-secret";

const base64url = (value) => Buffer.from(value).toString("base64url");
const signPayload = (payload) =>
  crypto.createHmac("sha256", authSecret).update(payload).digest("base64url");
const createToken = (admin) => {
  const payload = base64url(JSON.stringify({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    exp: Date.now() + 1000 * 60 * 60 * 12
  }));
  return `${payload}.${signPayload(payload)}`;
};
const verifyToken = (token) => {
  try {
    if (!token || !token.includes(".")) return null;
    const [payload, signature] = token.split(".");
    const expected = signPayload(payload);
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
};
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({
  salt,
  hash: crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex")
});
const passwordMatches = (password, salt, hash) => {
  const candidate = hashPassword(password, salt).hash;
  if (candidate.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
};
const randomPassword = () => crypto.randomBytes(9).toString("base64url");

const ensureAdminTable = async () => {
  if (!pool) return;
  await pool.query("create schema if not exists internal");
  await pool.query(`
    create table if not exists internal.dashboard_admin_users (
      id uuid primary key,
      name text not null,
      email text not null unique,
      role text not null default 'Administrator',
      password_hash text not null,
      password_salt text not null,
      must_reset_password boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  const count = await pool.query("select count(*)::int as total from internal.dashboard_admin_users where is_active = true");
  if (count.rows[0].total === 0) {
    const password = process.env.DASHBOARD_ADMIN_PASSWORD || "admin123";
    const { salt, hash } = hashPassword(password);
    await pool.query(
      `
        insert into internal.dashboard_admin_users (id, name, email, role, password_hash, password_salt)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [crypto.randomUUID(), "Pigui Admin", "admin@pigui.ai", "Administrator", hash, salt]
    );
  }
};

const requireAuth = (req, res, next) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.admin = session;
  next();
};

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
  acceptedRecommendations: 0,
  webUsers: 0,
  mobileUsers: 0,
  b2bUsers: 0,
  b2cUsers: 0,
  b2oUsers: 0
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

app.post("/api/auth/sign-in", async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    await ensureAdminTable();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const result = await pool.query(
      `
        select id::text, name, email, role, password_hash, password_salt, must_reset_password
        from internal.dashboard_admin_users
        where lower(email) = $1 and is_active = true
        limit 1
      `,
      [email]
    );
    const admin = result.rows[0];
    if (!admin || !passwordMatches(password, admin.password_salt, admin.password_hash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    res.json({
      token: createToken(admin),
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        mustResetPassword: admin.must_reset_password
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/me", requireAuth, async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    await ensureAdminTable();
    const result = await pool.query(
      `
        select id::text, name, email, role
        from internal.dashboard_admin_users
        where id::text = $1 and is_active = true
      `,
      [req.admin.sub]
    );
    if (!result.rows[0]) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", requireAuth, async (_req, res, next) => {
  if (!requireDb(res)) return;

  try {
    await ensureAdminTable();
    const result = await pool.query(
      `
        select id::text, name, email, role, must_reset_password, is_active, created_at, updated_at
        from internal.dashboard_admin_users
        order by created_at desc
      `
    );
    res.json(result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      mustResetPassword: row.must_reset_password,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/users", requireAuth, async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    await ensureAdminTable();
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = String(req.body.role || "Viewer").trim();
    const temporaryPassword = String(req.body.password || randomPassword());
    if (!name || !email || !temporaryPassword) {
      res.status(400).json({ error: "Name, email and password are required" });
      return;
    }
    const { salt, hash } = hashPassword(temporaryPassword);
    const result = await pool.query(
      `
        insert into internal.dashboard_admin_users (id, name, email, role, password_hash, password_salt, must_reset_password)
        values ($1, $2, $3, $4, $5, $6, true)
        returning id::text, name, email, role, must_reset_password, is_active, created_at, updated_at
      `,
      [crypto.randomUUID(), name, email, role, hash, salt]
    );
    const row = result.rows[0];
    res.status(201).json({
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        mustResetPassword: row.must_reset_password,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      temporaryPassword
    });
  } catch (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Admin user already exists" });
      return;
    }
    next(error);
  }
});

app.post("/api/admin/users/:id/reset-password", requireAuth, async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    await ensureAdminTable();
    const temporaryPassword = String(req.body.password || randomPassword());
    const { salt, hash } = hashPassword(temporaryPassword);
    const result = await pool.query(
      `
        update internal.dashboard_admin_users
        set password_hash = $2,
            password_salt = $3,
            must_reset_password = true,
            updated_at = now()
        where id::text = $1 and is_active = true
        returning id::text, name, email, role, must_reset_password, is_active, updated_at
      `,
      [req.params.id, hash, salt]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Admin user not found" });
      return;
    }
    res.json({
      user: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email,
        role: result.rows[0].role,
        mustResetPassword: result.rows[0].must_reset_password,
        isActive: result.rows[0].is_active,
        updatedAt: result.rows[0].updated_at
      },
      temporaryPassword
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/summary", async (req, res, next) => {
  if (!requireDb(res)) return;

  try {
    const days = getDays(req.query.days);
    const summary = emptySummary();

    if (await tableExists("business.onboarding_voice_sessions")) {
      const result = await pool.query(
        `
          with active_users as (
            select distinct user_id
            from business.onboarding_voice_sessions
            where is_active = true
              and created_at >= now() - ($1::int * interval '1 day')
          ),
          user_flags as (
            select
              au.user_id,
              exists(
                select 1 from business.business_profile bp
                where bp.user_id = au.user_id and bp.is_active = true
              ) as has_b2b,
              exists(
                select 1 from customer.customer_profile cp
                where cp.user_id = au.user_id and cp.is_active = true
              ) or exists(
                select 1 from customer.shopping_cart sc
                where sc.user_id = au.user_id
                  and sc.is_active = true
                  and (sc.source_type::text = 'B2C' or sc.source_product::text = 'B2C')
              ) as has_b2c,
              exists(
                select 1 from customer.shopping_cart sc
                where sc.user_id = au.user_id
                  and sc.is_active = true
                  and (sc.source_type::text = 'B2O' or sc.source_product::text = 'B2O')
              ) as has_b2o,
              exists(
                select 1 from common.user_devices ud
                where ud.user_id = au.user_id and ud.is_active = true and ud.device_type::text = 'web'
              ) as has_web,
              exists(
                select 1 from common.user_devices ud
                where ud.user_id = au.user_id and ud.is_active = true and ud.device_type::text in ('ios', 'android')
              ) as has_mobile
            from active_users au
          ),
          session_metrics as (
            select
              count(distinct user_id)::int as users,
              count(*)::int as sessions,
              count(*) filter (where status = 'completed')::int as completed_sessions,
              coalesce(sum(jsonb_array_length(coalesce(answers, '[]'::jsonb))), 0)::int as answers,
              coalesce(avg(jsonb_array_length(coalesce(answers, '[]'::jsonb))), 0)::float as avg_answers_per_session
            from business.onboarding_voice_sessions
            where is_active = true
              and created_at >= now() - ($1::int * interval '1 day')
          )
          select
            sm.*,
            (select count(*)::int from user_flags where has_web) as web_users,
            (select count(*)::int from user_flags where has_mobile) as mobile_users,
            (select count(*)::int from user_flags where has_b2b) as b2b_users,
            (select count(*)::int from user_flags where has_b2c) as b2c_users,
            (select count(*)::int from user_flags where has_b2o) as b2o_users
          from session_metrics sm
        `,
        [days]
      );
      Object.assign(summary, {
        users: result.rows[0].users,
        sessions: result.rows[0].sessions,
        completedSessions: result.rows[0].completed_sessions,
        answers: result.rows[0].answers,
        avgAnswersPerSession: Number(result.rows[0].avg_answers_per_session || 0),
        webUsers: result.rows[0].web_users,
        mobileUsers: result.rows[0].mobile_users,
        b2bUsers: result.rows[0].b2b_users,
        b2cUsers: result.rows[0].b2c_users,
        b2oUsers: result.rows[0].b2o_users
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
        with session_metrics as (
          select
            user_id,
            count(*)::int as sessions,
            count(distinct branch_id)::int as branches,
            count(*) filter (where status = 'completed')::int as completed_sessions,
            coalesce(sum(jsonb_array_length(coalesce(answers, '[]'::jsonb))), 0)::int as answers,
            coalesce(avg(jsonb_array_length(coalesce(answers, '[]'::jsonb))), 0)::float as avg_answers_per_session,
            max(updated_at) as last_activity_at
          from business.onboarding_voice_sessions
          where is_active = true
            and created_at >= now() - ($1::int * interval '1 day')
          group by user_id
        ),
        profile as (
          select
            sm.user_id,
            u.email,
            u.phone,
            nullif(
              trim(concat_ws(' ',
                coalesce(bp.first_name, cp.first_name),
                coalesce(bp.last_name, cp.last_name),
                coalesce(bp.second_last_name, cp.second_last_name)
              )),
              ''
            ) as display_name,
            exists(select 1 from business.business_profile x where x.user_id = sm.user_id and x.is_active = true) as has_b2b,
            exists(select 1 from customer.customer_profile x where x.user_id = sm.user_id and x.is_active = true) as has_b2c_profile,
            exists(
              select 1 from customer.shopping_cart sc
              where sc.user_id = sm.user_id and sc.is_active = true
                and (sc.source_type::text = 'B2C' or sc.source_product::text = 'B2C')
            ) as has_b2c_source,
            exists(
              select 1 from customer.shopping_cart sc
              where sc.user_id = sm.user_id and sc.is_active = true
                and (sc.source_type::text = 'B2O' or sc.source_product::text = 'B2O')
            ) as has_b2o
          from session_metrics sm
          left join common."user" u on u.id = sm.user_id
          left join business.business_profile bp on bp.user_id = sm.user_id and bp.is_active = true
          left join customer.customer_profile cp on cp.user_id = sm.user_id and cp.is_active = true
        ),
        latest_device as (
          select distinct on (ud.user_id)
            ud.user_id,
            ud.device_type::text as device_type,
            ud.device_name,
            ud.last_activity
          from common.user_devices ud
          join session_metrics sm on sm.user_id = ud.user_id
          where ud.is_active = true
          order by ud.user_id, ud.last_activity desc nulls last, ud.updated_at desc
        ),
        source_counts as (
          select
            sc.user_id,
            count(*) filter (where sc.source_type::text = 'B2C' or sc.source_product::text = 'B2C')::int as b2c_events,
            count(*) filter (where sc.source_type::text = 'B2O' or sc.source_product::text = 'B2O')::int as b2o_events
          from customer.shopping_cart sc
          join session_metrics sm on sm.user_id = sc.user_id
          where sc.is_active = true
          group by sc.user_id
        )
        select
          sm.user_id::text as user_id,
          sm.sessions,
          sm.branches,
          sm.completed_sessions,
          sm.answers,
          sm.avg_answers_per_session,
          sm.last_activity_at,
          profile.email,
          profile.phone,
          profile.display_name,
          coalesce(ld.device_type, 'unknown') as device_type,
          ld.device_name,
          case
            when ld.device_type = 'web' then 'Web'
            when ld.device_type in ('ios', 'android') then 'Movil'
            else 'Sin dispositivo'
          end as channel,
          case
            when profile.has_b2b and profile.has_b2o and (profile.has_b2c_profile or profile.has_b2c_source) then 'B2B + B2O + B2C'
            when profile.has_b2b and profile.has_b2o then 'B2B + B2O'
            when profile.has_b2b and (profile.has_b2c_profile or profile.has_b2c_source) then 'B2B + B2C'
            when profile.has_b2o and (profile.has_b2c_profile or profile.has_b2c_source) then 'B2O + B2C'
            when profile.has_b2b then 'B2B'
            when profile.has_b2o then 'B2O'
            when profile.has_b2c_profile or profile.has_b2c_source then 'B2C'
            else 'Sin segmento'
          end as segment,
          profile.has_b2b,
          (profile.has_b2c_profile or profile.has_b2c_source) as has_b2c,
          profile.has_b2o,
          coalesce(source_counts.b2c_events, 0) as b2c_events,
          coalesce(source_counts.b2o_events, 0) as b2o_events
        from session_metrics sm
        join profile on profile.user_id = sm.user_id
        left join latest_device ld on ld.user_id = sm.user_id
        left join source_counts on source_counts.user_id = sm.user_id
        where $2::text = ''
          or sm.user_id::text ilike '%' || $2::text || '%'
          or coalesce(profile.email, '') ilike '%' || $2::text || '%'
          or coalesce(profile.display_name, '') ilike '%' || $2::text || '%'
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
      lastActivityAt: row.last_activity_at,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      channel: row.channel,
      deviceType: row.device_type,
      deviceName: row.device_name,
      segment: row.segment,
      hasB2b: row.has_b2b,
      hasB2c: row.has_b2c,
      hasB2o: row.has_b2o,
      b2cEvents: row.b2c_events,
      b2oEvents: row.b2o_events
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

    const [profile, sessions, sourceMetrics, deviceMetrics, answerSourceMetrics, blockMetrics, answers] = await Promise.all([
      pool.query(
        `
          with profile_flags as (
            select
              CAST($1 AS uuid) as user_id,
              exists(select 1 from business.business_profile bp where bp.user_id::text = $1::text and bp.is_active = true) as has_b2b,
              exists(select 1 from customer.customer_profile cp where cp.user_id::text = $1::text and cp.is_active = true) as has_b2c_profile,
              exists(
                select 1 from customer.shopping_cart sc
                where sc.user_id::text = $1::text and sc.is_active = true
                  and (sc.source_type::text = 'B2C' or sc.source_product::text = 'B2C')
              ) as has_b2c_source,
              exists(
                select 1 from customer.shopping_cart sc
                where sc.user_id::text = $1::text and sc.is_active = true
                  and (sc.source_type::text = 'B2O' or sc.source_product::text = 'B2O')
              ) as has_b2o
          ),
          latest_device as (
            select
              ud.device_type::text as device_type,
              ud.device_name,
              ud.last_activity
            from common.user_devices ud
            where ud.user_id::text = $1::text and ud.is_active = true
            order by ud.last_activity desc nulls last, ud.updated_at desc
            limit 1
          )
          select
            u.id::text as user_id,
            u.email,
            u.phone,
            nullif(
              trim(concat_ws(' ',
                coalesce(bp.first_name, cp.first_name),
                coalesce(bp.last_name, cp.last_name),
                coalesce(bp.second_last_name, cp.second_last_name)
              )),
              ''
            ) as display_name,
            coalesce(ld.device_type, 'unknown') as device_type,
            ld.device_name,
            ld.last_activity as device_last_activity,
            case
              when ld.device_type = 'web' then 'Web'
              when ld.device_type in ('ios', 'android') then 'Movil'
              else 'Sin dispositivo'
            end as channel,
            case
              when pf.has_b2b and pf.has_b2o and (pf.has_b2c_profile or pf.has_b2c_source) then 'B2B + B2O + B2C'
              when pf.has_b2b and pf.has_b2o then 'B2B + B2O'
              when pf.has_b2b and (pf.has_b2c_profile or pf.has_b2c_source) then 'B2B + B2C'
              when pf.has_b2o and (pf.has_b2c_profile or pf.has_b2c_source) then 'B2O + B2C'
              when pf.has_b2b then 'B2B'
              when pf.has_b2o then 'B2O'
              when pf.has_b2c_profile or pf.has_b2c_source then 'B2C'
              else 'Sin segmento'
            end as segment,
            pf.has_b2b,
            (pf.has_b2c_profile or pf.has_b2c_source) as has_b2c,
            pf.has_b2o
          from profile_flags pf
          left join common."user" u on u.id = pf.user_id
          left join business.business_profile bp on bp.user_id = pf.user_id and bp.is_active = true
          left join customer.customer_profile cp on cp.user_id = pf.user_id and cp.is_active = true
          left join latest_device ld on true
        `,
        [userId]
      ),
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
          select source, count(*)::int as total
          from (
            select coalesce(sc.source_type::text, sc.source_product::text, 'Sin segmento') as source
            from customer.shopping_cart sc
            where sc.user_id::text = $1 and sc.is_active = true
          ) data
          group by source
          order by total desc
        `,
        [userId]
      ),
      pool.query(
        `
          select device_type::text as device_type, count(*)::int as total
          from common.user_devices
          where user_id::text = $1 and is_active = true
          group by device_type
          order by total desc
        `,
        [userId]
      ),
      pool.query(
        `
          select
            coalesce(answer_item->>'answer_source', 'sin_fuente') as source,
            count(*)::int as total
          from business.onboarding_voice_sessions s
          cross join lateral jsonb_array_elements(coalesce(s.answers, '[]'::jsonb)) answer_item
          where s.is_active = true and s.user_id::text = $1
          group by source
          order by total desc
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
      profile: profile.rows[0] ? {
        userId: profile.rows[0].user_id,
        displayName: profile.rows[0].display_name,
        email: profile.rows[0].email,
        phone: profile.rows[0].phone,
        channel: profile.rows[0].channel,
        deviceType: profile.rows[0].device_type,
        deviceName: profile.rows[0].device_name,
        deviceLastActivity: profile.rows[0].device_last_activity,
        segment: profile.rows[0].segment,
        hasB2b: profile.rows[0].has_b2b,
        hasB2c: profile.rows[0].has_b2c,
        hasB2o: profile.rows[0].has_b2o
      } : null,
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
      sourceMetrics: sourceMetrics.rows.map((row) => ({ source: row.source, total: row.total })),
      deviceMetrics: deviceMetrics.rows.map((row) => ({ deviceType: row.device_type, total: row.total })),
      answerSourceMetrics: answerSourceMetrics.rows.map((row) => ({ source: row.source, total: row.total })),
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
