<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="window-controls" aria-hidden="true">
        <span class="control control--close"></span>
        <span class="control control--minimize"></span>
        <span class="control control--zoom"></span>
      </div>

      <div class="title-block">
        <p class="eyebrow">Pigui AI</p>
        <h1>Respuestas de agentes</h1>
        <p class="subtitle">Metricas por usuario desde la base de datos de conversaciones.</p>
      </div>

      <div class="filters">
        <label>
          Ventana
          <select v-model.number="days" @change="loadDashboard">
            <option :value="7">7 dias</option>
            <option :value="30">30 dias</option>
            <option :value="90">90 dias</option>
            <option :value="365">365 dias</option>
          </select>
        </label>
        <button class="primary-button" type="button" @click="loadDashboard">Actualizar</button>
      </div>
    </header>

    <section v-if="error" class="notice notice--error">{{ error }}</section>

    <section class="metrics-grid" aria-label="Metricas generales">
      <article v-for="metric in metrics" :key="metric.label" class="metric">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
      </article>
    </section>

    <section class="workspace">
      <aside class="users-panel">
        <div class="panel-header">
          <div>
            <h2>Usuarios</h2>
            <p>{{ users.length }} con actividad</p>
          </div>
          <input v-model="search" type="search" placeholder="Buscar correo" @input="loadUsers" />
        </div>

        <button
          v-for="user in users"
          :key="user.userId"
          class="user-row"
          :class="{ 'user-row--active': selectedUserId === user.userId }"
          type="button"
          @click="selectUser(user.userId)"
        >
          <span class="user-row__avatar">{{ initials(user.userId) }}</span>
          <span class="user-row__content">
            <span class="user-row__name">{{ user.email || user.displayName || "Sin correo" }}</span>
            <span class="user-row__id">{{ user.displayName || user.phone || user.segment }}</span>
            <span class="user-row__stats">{{ user.answers }} respuestas · {{ user.sessions }} sesiones</span>
            <span class="user-row__chips">
              <span class="mini-chip">{{ user.channel }}</span>
              <span class="mini-chip mini-chip--segment">{{ user.segment }}</span>
            </span>
          </span>
          <span class="user-row__badge">{{ user.completedSessions }}/{{ user.sessions }}</span>
        </button>
      </aside>

      <section class="detail-panel">
        <div class="panel-header">
          <div>
            <h2>{{ selectedUserId ? "Detalle por usuario" : "Respuestas recientes" }}</h2>
            <p>{{ selectedUser?.profile?.email || selectedUser?.profile?.displayName || selectedUserId || "Selecciona un usuario para ver sus metricas" }}</p>
          </div>
        </div>

        <article v-if="selectedUser?.profile" class="profile-card">
          <div class="profile-card__avatar">{{ initials(selectedUser.profile.userId) }}</div>
          <div class="profile-card__main">
            <h3>{{ selectedUser.profile.email || "Usuario sin correo" }}</h3>
            <p>{{ selectedUser.profile.displayName || selectedUser.profile.userId }}</p>
            <div class="profile-card__meta">
              <span class="pill pill--blue">{{ selectedUser.profile.channel }}</span>
              <span class="pill pill--green">{{ selectedUser.profile.segment }}</span>
              <span v-if="selectedUser.profile.email" class="pill">{{ selectedUser.profile.email }}</span>
              <span v-if="selectedUser.profile.phone" class="pill">{{ selectedUser.profile.phone }}</span>
              <span v-if="selectedUser.profile.deviceName" class="pill">{{ selectedUser.profile.deviceName }}</span>
            </div>
          </div>
        </article>

        <div v-if="selectedUser" class="detail-grid">
          <article class="detail-card">
            <div class="card-title">
              <h3>Sesiones</h3>
              <span>{{ selectedUser.sessions.length }}</span>
            </div>
            <div class="session-list">
              <div v-for="session in selectedUser.sessions" :key="session.id" class="session-row">
                <strong :class="`status status--${session.status}`">{{ session.status }}</strong>
                <span>{{ session.answersCount }} respuestas</span>
                <small>{{ formatDate(session.updatedAt) }}</small>
              </div>
            </div>
          </article>

          <article class="detail-card">
            <div class="card-title">
              <h3>Canal y origen</h3>
              <span>{{ selectedUser.answerSourceMetrics.length + selectedUser.deviceMetrics.length }}</span>
            </div>
            <div class="bar-list">
              <div v-for="item in channelRows" :key="item.label" class="bar-row">
                <span>{{ item.label }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: relativeWidth(item.total, channelRows) }"></div>
                </div>
                <strong>{{ item.total }}</strong>
              </div>
            </div>
          </article>
        </div>

        <div v-if="selectedUser" class="detail-grid detail-grid--secondary">
          <article class="detail-card">
            <div class="card-title">
              <h3>Bloques respondidos</h3>
              <span>{{ selectedUser.blockMetrics.length }}</span>
            </div>
            <div class="bar-list">
              <div v-for="block in selectedUser.blockMetrics" :key="block.block" class="bar-row">
                <span>{{ block.block }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: relativeWidth(block.answers, selectedUser.blockMetrics, 'answers') }"></div>
                </div>
                <strong>{{ block.answers }}</strong>
              </div>
            </div>
          </article>

          <article class="detail-card">
            <div class="card-title">
              <h3>B2B / B2O / B2C</h3>
              <span>{{ selectedUser.sourceMetrics.length || 1 }}</span>
            </div>
            <div class="segment-grid">
              <span class="segment-pill" :class="{ 'segment-pill--on': selectedUser.profile?.hasB2b }">B2B</span>
              <span class="segment-pill" :class="{ 'segment-pill--on': selectedUser.profile?.hasB2o }">B2O</span>
              <span class="segment-pill" :class="{ 'segment-pill--on': selectedUser.profile?.hasB2c }">B2C</span>
            </div>
            <div class="bar-list">
              <div v-for="source in selectedUser.sourceMetrics" :key="source.source" class="bar-row">
                <span>{{ source.source }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: relativeWidth(source.total, selectedUser.sourceMetrics, 'total') }"></div>
                </div>
                <strong>{{ source.total }}</strong>
              </div>
            </div>
          </article>
        </div>

        <article class="answers-list">
          <div class="card-title">
            <h3>{{ selectedUser ? "Respuestas del usuario" : "Ultimas respuestas guardadas" }}</h3>
            <span>{{ visibleAnswers.length }}</span>
          </div>
          <div v-for="answer in visibleAnswers" :key="answer.sessionId + answer.question + answer.updatedAt" class="answer-row">
            <div class="answer-row__meta">
              <span class="pill">{{ answer.block || "sin_bloque" }}</span>
              <span class="pill">{{ answer.answerSource || "sin_fuente" }}</span>
              <span>{{ formatDate(answer.updatedAt) }}</span>
              <span v-if="'userId' in answer">{{ answer.userId }}</span>
            </div>
            <p class="question">{{ answer.question || "Pregunta sin titulo" }}</p>
            <p class="answer">{{ answer.answer || "Sin respuesta registrada" }}</p>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

type Summary = {
  users: number;
  sessions: number;
  completedSessions: number;
  answers: number;
  avgAnswersPerSession: number;
  recommendationEvents: number;
  acceptedRecommendations: number;
  webUsers: number;
  mobileUsers: number;
  b2bUsers: number;
  b2cUsers: number;
  b2oUsers: number;
};

type UserRow = {
  userId: string;
  sessions: number;
  branches: number;
  completedSessions: number;
  answers: number;
  avgAnswersPerSession: number;
  lastActivityAt: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  channel: string;
  deviceType: string;
  deviceName: string | null;
  segment: string;
  hasB2b: boolean;
  hasB2c: boolean;
  hasB2o: boolean;
  b2cEvents: number;
  b2oEvents: number;
};

type AnswerRow = {
  userId?: string;
  sessionId: string;
  branchId: string | null;
  question: string | null;
  answer: string | null;
  answerSource?: string | null;
  block: string | null;
  updatedAt: string;
};

type UserDetail = {
  profile: {
    userId: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    channel: string;
    deviceType: string;
    deviceName: string | null;
    deviceLastActivity: string | null;
    segment: string;
    hasB2b: boolean;
    hasB2c: boolean;
    hasB2o: boolean;
  } | null;
  sessions: Array<{
    id: string;
    branchId: string | null;
    status: string;
    currentQuestionIndex: number;
    answersCount: number;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
  }>;
  blockMetrics: Array<{ block: string; answers: number }>;
  sourceMetrics: Array<{ source: string; total: number }>;
  deviceMetrics: Array<{ deviceType: string; total: number }>;
  answerSourceMetrics: Array<{ source: string; total: number }>;
  answers: AnswerRow[];
};

const days = ref(30);
const search = ref("");
const error = ref("");
const summary = ref<Summary>({
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
const users = ref<UserRow[]>([]);
const recentAnswers = ref<AnswerRow[]>([]);
const selectedUserId = ref("");
const selectedUser = ref<UserDetail | null>(null);
let searchTimer: number | undefined;

const api = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const metrics = computed(() => [
  { label: "Usuarios", value: summary.value.users.toLocaleString("es-MX") },
  { label: "Sesiones", value: summary.value.sessions.toLocaleString("es-MX") },
  { label: "Completadas", value: summary.value.completedSessions.toLocaleString("es-MX") },
  { label: "Respuestas", value: summary.value.answers.toLocaleString("es-MX") },
  { label: "Web / movil", value: `${summary.value.webUsers}/${summary.value.mobileUsers}` },
  { label: "B2B / B2O / B2C", value: `${summary.value.b2bUsers}/${summary.value.b2oUsers}/${summary.value.b2cUsers}` }
]);

const visibleAnswers = computed(() => selectedUser.value?.answers || recentAnswers.value);
const channelRows = computed(() => {
  if (!selectedUser.value) return [];

  const devices = selectedUser.value.deviceMetrics.map((item) => ({
    label: formatDevice(item.deviceType),
    total: item.total
  }));
  const answerSources = selectedUser.value.answerSourceMetrics.map((item) => ({
    label: `Respuesta: ${item.source}`,
    total: item.total
  }));

  if (devices.length === 0) {
    devices.push({ label: selectedUser.value.profile?.channel || "Sin dispositivo", total: 0 });
  }

  return [...devices, ...answerSources];
});

const loadSummary = async () => {
  summary.value = await api<Summary>(`/api/summary?days=${days.value}`);
};

const loadUsersNow = async () => {
  users.value = await api<UserRow[]>(`/api/users?days=${days.value}&search=${encodeURIComponent(search.value)}`);
  if (!selectedUserId.value && users.value.length > 0) {
    await selectUser(users.value[0].userId);
  }
};

const loadUsers = () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadUsersNow, 250);
};

const loadRecentAnswers = async () => {
  recentAnswers.value = await api<AnswerRow[]>("/api/answers?limit=80");
};

const selectUser = async (userId: string) => {
  selectedUserId.value = userId;
  selectedUser.value = await api<UserDetail>(`/api/users/${encodeURIComponent(userId)}`);
};

const loadDashboard = async () => {
  error.value = "";
  try {
    selectedUser.value = null;
    selectedUserId.value = "";
    await Promise.all([loadSummary(), loadUsersNow(), loadRecentAnswers()]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo cargar el dashboard";
  }
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const relativeWidth = <T extends Record<string, unknown>>(value: number, rows: T[], key: keyof T = "total") => {
  const values = rows.map((item) => Number(item[key] || 0));
  const max = Math.max(...values, 1);
  return `${Math.max((value / max) * 100, value > 0 ? 8 : 4)}%`;
};

const initials = (value: string) => value.replace(/-/g, "").slice(0, 2).toUpperCase();
const formatDevice = (value: string) => {
  if (value === "web") return "Web";
  if (value === "ios") return "Movil iOS";
  if (value === "android") return "Movil Android";
  return "Sin dispositivo";
};

onMounted(loadDashboard);
</script>
