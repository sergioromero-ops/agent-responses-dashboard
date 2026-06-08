<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Pigui AI</p>
        <h1>Dashboard de respuestas de agentes</h1>
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
        <button type="button" @click="loadDashboard">Actualizar</button>
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
          <input v-model="search" type="search" placeholder="Buscar user_id" @input="loadUsers" />
        </div>

        <button
          v-for="user in users"
          :key="user.userId"
          class="user-row"
          :class="{ 'user-row--active': selectedUserId === user.userId }"
          type="button"
          @click="selectUser(user.userId)"
        >
          <span class="user-row__id">{{ user.userId }}</span>
          <span>{{ user.answers }} respuestas</span>
          <span>{{ user.completedSessions }}/{{ user.sessions }} sesiones completas</span>
        </button>
      </aside>

      <section class="detail-panel">
        <div class="panel-header">
          <div>
            <h2>{{ selectedUserId ? "Detalle por usuario" : "Respuestas recientes" }}</h2>
            <p>{{ selectedUserId || "Selecciona un usuario para ver sus metricas" }}</p>
          </div>
        </div>

        <div v-if="selectedUser" class="detail-grid">
          <article class="detail-card">
            <h3>Sesiones</h3>
            <div class="session-list">
              <div v-for="session in selectedUser.sessions" :key="session.id" class="session-row">
                <strong>{{ session.status }}</strong>
                <span>{{ session.answersCount }} respuestas</span>
                <small>{{ formatDate(session.updatedAt) }}</small>
              </div>
            </div>
          </article>

          <article class="detail-card">
            <h3>Bloques respondidos</h3>
            <div class="bar-list">
              <div v-for="block in selectedUser.blockMetrics" :key="block.block" class="bar-row">
                <span>{{ block.block }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: barWidth(block.answers) }"></div>
                </div>
                <strong>{{ block.answers }}</strong>
              </div>
            </div>
          </article>
        </div>

        <article class="answers-list">
          <h3>{{ selectedUser ? "Respuestas del usuario" : "Ultimas respuestas guardadas" }}</h3>
          <div v-for="answer in visibleAnswers" :key="answer.sessionId + answer.question + answer.updatedAt" class="answer-row">
            <div class="answer-row__meta">
              <span>{{ answer.block || "sin_bloque" }}</span>
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
};

type UserRow = {
  userId: string;
  sessions: number;
  branches: number;
  completedSessions: number;
  answers: number;
  avgAnswersPerSession: number;
  lastActivityAt: string;
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
  acceptedRecommendations: 0
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
  { label: "Promedio", value: summary.value.avgAnswersPerSession.toFixed(1) },
  { label: "Feedback agente", value: summary.value.recommendationEvents.toLocaleString("es-MX") }
]);

const visibleAnswers = computed(() => selectedUser.value?.answers || recentAnswers.value);

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

const barWidth = (answers: number) => {
  const max = Math.max(...(selectedUser.value?.blockMetrics.map((item) => item.answers) || [1]));
  return `${Math.max((answers / max) * 100, 6)}%`;
};

onMounted(loadDashboard);
</script>
