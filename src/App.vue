<template>
  <main v-if="!isSignedIn" class="signin-page">
    <section class="signin-card">
      <div class="signin-brand">Pigui AI</div>
      <h1>Sign in</h1>
      <label>
        Email
        <input v-model="signInEmail" type="email" autocomplete="email" />
      </label>
      <label>
        Password
        <input v-model="signInPassword" type="password" autocomplete="current-password" />
      </label>
      <p v-if="authError" class="form-error">{{ authError }}</p>
      <button class="primary-action" type="button" @click="signIn">Sign in</button>
      <button class="link-action" type="button">Forgot password?</button>
      <div class="signin-footer">
        <span>Internal use only</span>
        <select v-model="settings.dashboardLanguage">
          <option value="English">English</option>
          <option value="Spanish">Spanish</option>
        </select>
      </div>
    </section>
  </main>

  <main v-else class="app-frame">
    <aside class="sidebar">
      <div class="brand-block">
        <img class="brand-mark" src="/pigui-logo.jpg" alt="Pigui" />
        <div>
          <strong>Pigui AI</strong>
          <small>Agents Dashboard</small>
        </div>
      </div>

      <nav class="nav-list" aria-label="Main navigation">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ 'nav-item--active': activeNav === item.id }"
          type="button"
          @click="goTo(item.id)"
        >
          <span class="nav-dot" aria-hidden="true"></span>
          {{ label(item.id) }}
        </button>
      </nav>

      <div class="admin-account">
        <span>{{ copy.adminAccount }}</span>
        <strong>admin@pigui.ai</strong>
      </div>
    </aside>

    <section class="content-shell">
      <header class="content-topbar">
        <div>
          <p class="eyebrow">{{ copy.internalPlatform }}</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <label v-if="showDateSelector" class="date-select">
          {{ copy.dateRange }}
          <select v-model="selectedRange">
            <option v-for="range in dateRanges" :key="range">{{ range }}</option>
          </select>
        </label>
      </header>

      <div v-if="dashboardError" class="data-alert">{{ dashboardError }}</div>
      <div v-else-if="isLoadingData" class="data-alert data-alert--loading">Loading production data...</div>

      <section v-if="route === 'dashboard'" class="page-stack">
        <section class="panel">
          <div class="section-heading">
            <h2>Overview Metrics</h2>
          </div>
          <div class="overview-grid">
            <article v-for="metric in overviewMetrics" :key="metric.title" class="metric-card" :class="metric.color ? `metric-card--${metric.color}` : ''">
              <span class="metric-card__label">{{ metric.title }}</span>
              <strong>{{ metric.value }}</strong>
              <p>{{ metric.detail }}</p>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-heading">
            <h2>Customer Journey Flow</h2>
          </div>
          <div class="journey-grid">
            <article v-for="agent in agents" :key="agent.id" class="journey-step">
              <span class="journey-step__number">{{ agent.step }}</span>
              <div>
                <h3>{{ agent.name }}</h3>
                <span class="area-chip" :class="areaClass(agent.area)">{{ agent.area }}</span>
                <strong>{{ agent.conversations.toLocaleString() }} conversations</strong>
                <p>{{ agent.purpose }}</p>
              </div>
            </article>
          </div>
        </section>
      </section>

      <section v-else-if="route === 'clients'" class="page-stack">
        <div class="metric-row">
          <article v-for="metric in clientMetrics" :key="metric.title" class="stat-card">
            <span>{{ metric.title }}</span>
            <strong>{{ metric.value }}</strong>
            <p>{{ metric.detail }}</p>
          </article>
        </div>

        <section class="panel">
          <div class="table-toolbar">
            <h2>Clients</h2>
            <input v-model="clientSearch" type="search" placeholder="Search by name, email or phone" />
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Country</th>
                  <th>State</th>
                  <th>City</th>
                  <th>Interactions</th>
                  <th>Journey</th>
                  <th>Last agent</th>
                  <th>Last activity</th>
                  <th>Status</th>
                  <th>View client</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="client in filteredClients" :key="client.id">
                  <td>{{ client.name }}</td>
                  <td>{{ client.email }}</td>
                  <td>{{ client.phone }}</td>
                  <td>{{ client.country }}</td>
                  <td>{{ client.state }}</td>
                  <td>{{ client.city }}</td>
                  <td>{{ client.interactions }}</td>
                  <td>{{ client.journey }}</td>
                  <td>{{ client.lastAgent }}</td>
                  <td>{{ client.lastActivity }}</td>
                  <td><span class="status-chip" :class="statusClass(client.status)">{{ client.status }}</span></td>
                  <td><button class="table-action" type="button" @click="openClient(client.id)">View client</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section v-else-if="route === 'client-detail' && selectedClient" class="page-stack">
        <div class="breadcrumb">Clients / {{ selectedClient.name }}</div>
        <div class="metric-row">
          <article class="stat-card"><span>Interactions</span><strong>{{ selectedClient.interactions }}</strong><p>Total interactions registered</p></article>
          <article class="stat-card"><span>Journey</span><strong>{{ selectedClient.journey }}</strong><p>Completed stages</p></article>
          <article class="stat-card"><span>Last agent</span><strong>{{ selectedClient.lastAgent }}</strong><p>Last conversation registered</p></article>
          <article class="stat-card"><span>Last activity</span><strong>{{ selectedClient.lastActivity }}</strong><p>Most recent activity</p></article>
        </div>
        <div class="two-column">
          <section class="panel">
            <h2>Client information</h2>
            <dl class="detail-list">
              <div><dt>Name</dt><dd>{{ selectedClient.name }}</dd></div>
              <div><dt>Email</dt><dd>{{ selectedClient.email }}</dd></div>
              <div><dt>Phone</dt><dd>{{ selectedClient.phone }}</dd></div>
              <div><dt>Country</dt><dd>{{ selectedClient.country }}</dd></div>
              <div><dt>State</dt><dd>{{ selectedClient.state }}</dd></div>
              <div><dt>City</dt><dd>{{ selectedClient.city }}</dd></div>
              <div><dt>Client status</dt><dd>{{ selectedClient.status }}</dd></div>
            </dl>
          </section>
          <section class="panel">
            <h2>Identifiers</h2>
            <dl class="detail-list">
              <div><dt>Pigui Business ID</dt><dd>{{ selectedClient.piguiBusinessId }}</dd></div>
              <div><dt>Pigui Scan ID</dt><dd>{{ selectedClient.piguiScanId }}</dd></div>
              <div><dt>Pigui Rewards ID</dt><dd>{{ selectedClient.piguiRewardsId }}</dd></div>
            </dl>
            <button class="primary-action" type="button" @click="openClientConversations(selectedClient.id)">View conversations</button>
          </section>
        </div>
      </section>

      <section v-else-if="route === 'client-conversations' && selectedClient" class="page-stack">
        <div class="breadcrumb">Clients / {{ selectedClient.name }} / Conversations</div>
        <div class="metric-row">
          <article class="stat-card"><span>Selected client</span><strong>{{ selectedClient.name }}</strong><p>Client context</p></article>
          <article class="stat-card"><span>Conversations</span><strong>{{ selectedClientConversations.length }}</strong><p>transcripts</p></article>
          <article class="stat-card"><span>Last interaction</span><strong>{{ selectedClient.lastActivity }}</strong><p>Most recent activity</p></article>
        </div>
        <ConversationTable :rows="selectedClientConversations" @transcript="openTranscript" @download="downloadTranscript" />
      </section>

      <section v-else-if="route === 'conversations'" class="page-stack">
        <div class="metric-row">
          <article v-for="metric in conversationMetrics" :key="metric.title" class="stat-card">
            <span>{{ metric.title }}</span>
            <strong>{{ metric.value }}</strong>
            <p>{{ metric.detail }}</p>
          </article>
        </div>
        <section class="panel">
          <div class="table-toolbar">
            <div>
              <h2>Conversations</h2>
              <p>Global history of conversations across all clients and agents.</p>
            </div>
            <input v-model="conversationSearch" type="search" placeholder="Search conversation or client" />
          </div>
          <div class="filter-row">
            <select v-model="conversationFilters.area"><option>All areas</option><option>Web</option><option>B2B</option><option>B2C</option><option>B2O</option></select>
            <select v-model="conversationFilters.agent"><option>All agents</option><option v-for="agent in agents" :key="agent.name">{{ agent.name }}</option></select>
            <select v-model="conversationFilters.status"><option>All statuses</option><option>Completed</option><option>In progress</option><option>Failed</option></select>
            <select v-model="conversationFilters.friction"><option>All friction</option><option>Yes</option><option>No</option></select>
          </div>
          <ConversationTable :rows="filteredConversations" @transcript="openTranscript" @download="downloadTranscript" />
        </section>
      </section>

      <section v-else-if="route === 'transcript' && selectedConversation" class="page-stack">
        <div class="breadcrumb">{{ transcriptContext === 'clients' ? `Clients / ${selectedConversation.client} / Conversations / Transcript` : `Conversations / ${selectedConversation.client} / ${selectedConversation.agent} / Transcript` }}</div>
        <div class="metric-row">
          <article class="stat-card"><span>Client</span><strong>{{ selectedConversation.client }}</strong><p>{{ selectedConversation.area }} context</p></article>
          <article class="stat-card"><span>Agent</span><strong>{{ selectedConversation.agent }}</strong><p>Conversation owner</p></article>
          <article class="stat-card"><span>Date</span><strong>{{ selectedConversation.date }}</strong><p>Conversation date</p></article>
          <article class="stat-card"><span>Duration</span><strong>{{ selectedConversation.duration }}</strong><p>Total duration</p></article>
        </div>
        <section class="panel">
          <div class="table-toolbar">
            <h2>Full transcript</h2>
            <button class="primary-action" type="button" @click="downloadTranscript(selectedConversation.id)">Download transcript</button>
          </div>
          <div class="transcript-list">
            <article v-for="row in selectedConversation.transcript" :key="row.timestamp + row.message" class="transcript-row" :class="row.speaker === 'Pigui' ? 'transcript-row--pigui' : 'transcript-row--client'">
              <time>{{ row.timestamp }}</time>
              <strong>{{ row.speaker }}:</strong>
              <p>{{ row.message }}</p>
            </article>
          </div>
        </section>
      </section>

      <section v-else-if="route === 'agents'" class="page-stack">
        <div class="metric-row">
          <article v-for="metric in agentMetrics" :key="metric.title" class="stat-card">
            <span>{{ metric.title }}</span>
            <strong>{{ metric.value }}</strong>
            <p>{{ metric.detail }}</p>
          </article>
        </div>
        <section class="panel">
          <div class="table-toolbar">
            <h2>Agents</h2>
            <input v-model="agentSearch" type="search" placeholder="Search agent" />
          </div>
          <div class="filter-row">
            <select v-model="agentFilters.area"><option>All areas</option><option>Web</option><option>B2B</option><option>B2C</option><option>B2O</option></select>
            <select v-model="agentFilters.status"><option>All statuses</option><option>Active</option></select>
            <select v-model="agentFilters.type"><option>All types</option><option>Commercial</option><option>Baseline</option><option>Feedback</option><option>Operative</option><option>Financial</option><option>Consumer</option></select>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Agent</th><th>Area</th><th>Status</th><th>Type</th><th>Clients with activity</th><th>Conversations</th><th>Last activity</th></tr></thead>
              <tbody>
                <tr v-for="agent in filteredAgents" :key="agent.id">
                  <td>{{ agent.name }}</td>
                  <td><span class="area-chip" :class="areaClass(agent.area)">{{ agent.area }}</span></td>
                  <td><span class="status-chip status-chip--completed">{{ agent.status }}</span></td>
                  <td>{{ agent.type }}</td>
                  <td>{{ agent.clientsWithActivity }}</td>
                  <td>{{ agent.conversations }}</td>
                  <td>{{ agent.lastActivity }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section v-else-if="route === 'insights'" class="page-stack">
        <div class="metric-row">
          <article v-for="metric in insightMetrics" :key="metric.title" class="stat-card">
            <span>{{ metric.title }}</span>
            <strong>{{ metric.value }}</strong>
            <p>{{ metric.detail }}</p>
          </article>
        </div>
        <div class="insight-blocks">
          <section v-for="block in insightBlocks" :key="block.title" class="panel">
            <h2>{{ block.title }}</h2>
            <ul class="insight-list">
              <li v-for="item in block.items" :key="item">{{ item }}</li>
            </ul>
          </section>
        </div>
        <section class="panel">
          <h2>Insights table</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Insight</th><th>Area</th><th>Source agent</th><th>Related clients</th><th>Priority</th><th>Date</th></tr></thead>
              <tbody>
                <tr v-for="insight in insights" :key="insight.id">
                  <td>{{ insight.type }}</td>
                  <td>{{ insight.insight }}</td>
                  <td><span class="area-chip" :class="areaClass(insight.area)">{{ insight.area }}</span></td>
                  <td>{{ insight.sourceAgent }}</td>
                  <td>{{ insight.relatedClients }}</td>
                  <td><span class="priority" :class="`priority--${insight.priority.toLowerCase()}`">{{ insight.priority }}</span></td>
                  <td>{{ insight.date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section v-else-if="route === 'settings'" class="page-stack settings-grid">
        <section class="panel">
          <h2>Administrator Profile</h2>
          <label>Name<input v-model="settings.adminName" /></label>
          <label>Email<input v-model="settings.adminEmail" /></label>
          <label>Role<input v-model="settings.adminRole" /></label>
          <button class="secondary-action" type="button" @click="resetAdminPassword(authAdminId)">Reset my password</button>
          <p v-if="adminNotice" class="form-note">{{ adminNotice }}</p>
        </section>
        <section class="panel admin-users-panel">
          <h2>Admin Users</h2>
          <div class="admin-form">
            <label>Name<input v-model="newAdmin.name" placeholder="Full name" /></label>
            <label>Email<input v-model="newAdmin.email" type="email" placeholder="admin@pigui.ai" /></label>
            <label>Role<select v-model="newAdmin.role"><option>Administrator</option><option>Editor</option><option>Viewer</option></select></label>
            <label>Temporary password<input v-model="newAdmin.password" type="text" placeholder="Leave empty to generate" /></label>
            <button class="primary-action" type="button" @click="createAdminUser">Create user</button>
          </div>
          <div class="table-wrap admin-users-table">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="admin in adminUsers" :key="admin.id">
                  <td>{{ admin.name }}</td>
                  <td>{{ admin.email }}</td>
                  <td>{{ admin.role }}</td>
                  <td><span class="status-chip" :class="admin.isActive ? 'status-chip--completed' : 'status-chip--failed'">{{ admin.isActive ? 'Active' : 'Inactive' }}</span></td>
                  <td><button class="table-action" type="button" @click="resetAdminPassword(admin.id)">Reset password</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          <h2>Dashboard Preferences</h2>
          <label>Dashboard language<select v-model="settings.dashboardLanguage"><option>English</option><option>Spanish</option></select></label>
          <label>Time zone<select v-model="settings.timeZone"><option>US Central Time</option><option>US Eastern Time</option><option>US Pacific Time</option><option>US Mountain Time</option><option>Mexico City</option><option>Custom</option></select></label>
          <label>Default date range<select v-model="settings.defaultDateRange"><option v-for="range in dateRanges" :key="range">{{ range }}</option></select></label>
          <label>Time format<select v-model="settings.timeFormat"><option>12-hour</option><option>24-hour</option></select></label>
          <button class="primary-action" type="button">Save changes</button>
        </section>
        <section class="panel">
          <h2>Alerts & Monitoring</h2>
          <label class="toggle-row"><input v-model="settings.criticalFrictionAlerts" type="checkbox" /> Critical friction alerts</label>
          <label class="toggle-row"><input v-model="settings.integrationFailureAlerts" type="checkbox" /> Integration failure alerts</label>
          <label class="toggle-row"><input v-model="settings.automaticInsightsSummary" type="checkbox" /> Automatic insights summary</label>
        </section>
        <section class="panel">
          <h2>Integrations</h2>
          <article v-for="integration in integrations" :key="integration.name" class="integration-row">
            <div>
              <strong>{{ integration.name }}</strong>
              <p>{{ integration.description }}</p>
            </div>
            <span class="status-chip status-chip--completed">Connected</span>
          </article>
        </section>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch } from "vue";

type NavId = "dashboard" | "clients" | "conversations" | "agents" | "insights" | "settings";
type Route = NavId | "client-detail" | "client-conversations" | "transcript";
type Area = "Web" | "B2B" | "B2C" | "B2O";
type Status = "Completed" | "In progress" | "New" | "Failed";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  interactions: number;
  journey: string;
  lastAgent: string;
  lastActivity: string;
  status: Status;
  piguiBusinessId: string;
  piguiScanId: string;
  piguiRewardsId: string;
};

type Agent = {
  id: string;
  step: string;
  name: string;
  area: Area;
  status: "Active";
  type: string;
  clientsWithActivity: number;
  conversations: number;
  lastActivity: string;
  purpose: string;
};

type TranscriptRow = { timestamp: string; speaker: "Pigui" | string; message: string };
type Conversation = {
  id: string;
  clientId: string;
  client: string;
  agent: string;
  area: Area;
  date: string;
  duration: string;
  status: "Completed" | "In progress" | "Failed";
  friction: "Yes" | "No";
  transcript: TranscriptRow[];
};
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  mustResetPassword: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const isSignedIn = ref(false);
const signInEmail = ref("admin@pigui.ai");
const signInPassword = ref("");
const route = ref<Route>("dashboard");
const activeNav = ref<NavId>("dashboard");
const selectedRange = ref("Last 30 days");
const selectedClientId = ref("");
const selectedConversationId = ref("");
const transcriptContext = ref<"clients" | "conversations">("conversations");
const clientSearch = ref("");
const conversationSearch = ref("");
const agentSearch = ref("");
const isLoadingData = ref(false);
const dashboardError = ref("");
const authToken = ref(localStorage.getItem("pigui_dashboard_token") || "");
const authError = ref("");
const adminUsers = ref<AdminUser[]>([]);
const adminNotice = ref("");
const newAdmin = ref({ name: "", email: "", role: "Viewer", password: "" });
const apiSummary = ref({
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
const conversationFilters = ref({ area: "All areas", agent: "All agents", status: "All statuses", friction: "All friction" });
const agentFilters = ref({ area: "All areas", status: "All statuses", type: "All types" });
const dateRanges = ["Last 7 days", "Last 30 days", "Last 90 days", "Last 12 months", "Custom"];
const navItems: Array<{ id: NavId }> = [
  { id: "dashboard" },
  { id: "clients" },
  { id: "conversations" },
  { id: "agents" },
  { id: "insights" },
  { id: "settings" }
];

const settings = ref({
  adminName: "Dante Kurai",
  adminEmail: "admin@pigui.ai",
  adminRole: "Administrator",
  dashboardLanguage: "English",
  timeZone: "US Central Time",
  defaultDateRange: "Last 30 days",
  timeFormat: "12-hour",
  criticalFrictionAlerts: true,
  integrationFailureAlerts: true,
  automaticInsightsSummary: true
});

const copy = computed(() => {
  const spanish = settings.value.dashboardLanguage === "Spanish";
  return {
    internalPlatform: spanish ? "Plataforma interna" : "Internal platform",
    adminAccount: spanish ? "Cuenta de administrador" : "Admin account",
    dateRange: spanish ? "Rango de fecha" : "Date range",
    dashboard: spanish ? "Dashboard" : "Dashboard",
    clients: spanish ? "Clientes" : "Clients",
    conversations: spanish ? "Conversaciones" : "Conversations",
    agents: spanish ? "Agentes" : "Agents",
    insights: spanish ? "Hallazgos" : "Insights",
    settings: spanish ? "Configuración" : "Settings"
  };
});

const label = (id: NavId) => copy.value[id];

const agentCatalog: Agent[] = [
  { id: "website", step: "01", name: "Website Agent", area: "Web", status: "Active", type: "Commercial", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Captures website visitor and prospect conversations." },
  { id: "baseline-b2b", step: "02", name: "Personal & Business Baseline Agent", area: "B2B", status: "Active", type: "Baseline", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Gets to know the user and the business inside Pigui Business." },
  { id: "onboarding-feedback", step: "03", name: "Onboarding Feedback Agent", area: "B2B", status: "Active", type: "Feedback", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Captures feedback after onboarding." },
  { id: "branch", step: "04", name: "Operative Branch Agent", area: "B2B", status: "Active", type: "Operative", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Supports operational branch-related questions." },
  { id: "financial", step: "05", name: "Dashboard Financial Agent", area: "B2B", status: "Active", type: "Financial", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Helps users understand numbers, financial metrics, and dashboard data." },
  { id: "consumer-baseline", step: "06", name: "Consumer Baseline Agent", area: "B2C", status: "Active", type: "Consumer", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Gets to know the consumer inside Pigui Rewards." },
  { id: "rewards-feedback", step: "07", name: "Rewards Feedback Agent", area: "B2C", status: "Active", type: "Feedback", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Captures feedback about the Pigui Rewards experience." },
  { id: "scan-feedback", step: "08", name: "Scan Feedback Agent", area: "B2O", status: "Active", type: "Feedback", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Captures feedback about the Pigui Scan experience." },
  { id: "feedback-overview", step: "09", name: "Feedback Overview Agent", area: "B2B", status: "Active", type: "Feedback", clientsWithActivity: 0, conversations: 0, lastActivity: "No activity", purpose: "Captures final feedback after Business, Rewards, and Scan." }
];

const clients = ref<Client[]>([]);
const conversations = ref<Conversation[]>([]);
const insights = ref<Array<{ id: string; type: string; insight: string; area: Area; sourceAgent: string; relatedClients: number; priority: string; date: string }>>([]);

const integrations = [
  { name: "Internal database", description: "Stores clients, conversations, agents, transcripts and metrics." },
  { name: "AI Feedback", description: "Processes frictions, bugs, confusion, opportunities and risks automatically." },
  { name: "Machine Learning Layer", description: "Receives structured conversation data for global learning." }
];

const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatDate = (value?: string) => {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};
const daysFromRange = () => {
  if (selectedRange.value === "Last 7 days") return 7;
  if (selectedRange.value === "Last 90 days") return 90;
  if (selectedRange.value === "Last 12 months") return 365;
  return 30;
};
const apiGet = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path, {
    headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || body.error || `API request failed: ${path}`);
  }
  return body as T;
};
const apiPost = async <T,>(path: string, payload: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || body.error || `API request failed: ${path}`);
  }
  return body as T;
};
const inferAgent = (text = "") => {
  const normalized = text.toLowerCase();
  if (normalized.includes("reward") && normalized.includes("feedback")) return agentCatalog[6];
  if (normalized.includes("consumer") || normalized.includes("reward")) return agentCatalog[5];
  if (normalized.includes("scan") || normalized.includes("qr")) return agentCatalog[7];
  if (normalized.includes("financial") || normalized.includes("dashboard")) return agentCatalog[4];
  if (normalized.includes("branch") || normalized.includes("operative")) return agentCatalog[3];
  if (normalized.includes("feedback") || normalized.includes("friction") || normalized.includes("confus")) return agentCatalog[2];
  if (normalized.includes("website") || normalized.includes("web")) return agentCatalog[0];
  return agentCatalog[1];
};
const buildTranscript = (answers: Array<{ question?: string; answer?: string; order?: number }>, clientName: string): TranscriptRow[] =>
  answers.flatMap((answer, index) => {
    const timestamp = String(index + 1).padStart(2, "0");
    return [
      { timestamp: `${timestamp}:00`, speaker: "Pigui", message: answer.question || "Question not available" },
      { timestamp: `${timestamp}:30`, speaker: clientName, message: answer.answer || "No answer captured" }
    ];
  });
const containsFriction = (text: string) => /confus|difficult|hard|slow|bug|error|issue|problem|friction|unclear|no entend|dif[ií]cil|lento/i.test(text);
const mapStatus = (status?: string): Conversation["status"] => {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "In progress";
};
const mergeClientConversations = (clientId: string, nextConversations: Conversation[]) => {
  conversations.value = [
    ...conversations.value.filter((conversation) => conversation.clientId !== clientId),
    ...nextConversations
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
const loadClientDetail = async (clientId: string) => {
  if (!clientId || conversations.value.some((conversation) => conversation.clientId === clientId)) return;
  const detail = await apiGet<{
    profile?: { displayName?: string; email?: string };
    sessions: Array<{ id: string; status?: string; answersCount: number; updatedAt?: string; createdAt?: string }>;
    answers: Array<{ sessionId: string; question?: string; answer?: string; block?: string; questionId?: string; order?: number; updatedAt?: string }>;
  }>(`/api/users/${clientId}`);
  const client = clients.value.find((item) => item.id === clientId);
  const clientName = client?.name || detail.profile?.displayName || detail.profile?.email || clientId;
  const nextConversations = detail.sessions.map((session) => {
    const sessionAnswers = detail.answers
      .filter((answer) => answer.sessionId === session.id)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const firstAnswer = sessionAnswers[0];
    const text = sessionAnswers.map((answer) => `${answer.block || ""} ${answer.question || ""} ${answer.answer || ""}`).join(" ");
    const agent = inferAgent(`${firstAnswer?.block || ""} ${firstAnswer?.questionId || ""} ${text}`);
    return {
      id: session.id,
      clientId,
      client: clientName,
      agent: agent.name,
      area: agent.area,
      date: formatDate(session.updatedAt || session.createdAt),
      duration: `${Math.max(1, session.answersCount)} answers`,
      status: mapStatus(session.status),
      friction: containsFriction(text) ? "Yes" : "No",
      transcript: buildTranscript(sessionAnswers, clientName)
    } satisfies Conversation;
  });
  mergeClientConversations(clientId, nextConversations);
};
const buildInsights = () => {
  const frictionConversations = conversations.value.filter((conversation) => conversation.friction === "Yes");
  const areaCounts = conversations.value.reduce<Record<string, number>>((acc, conversation) => {
    acc[conversation.area] = (acc[conversation.area] || 0) + 1;
    return acc;
  }, {});
  const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0];
  insights.value = [
    ...(topArea ? [{
      id: "area-concentration",
      type: "Finding",
      insight: `${topArea[0]} concentrates the highest conversation activity in the selected period.`,
      area: topArea[0] as Area,
      sourceAgent: "Internal database",
      relatedClients: clients.value.length,
      priority: "Medium",
      date: formatDate(new Date().toISOString())
    }] : []),
    ...(frictionConversations.length ? [{
      id: "friction-signals",
      type: "Friction",
      insight: `${frictionConversations.length} conversations include possible confusion, bug, friction or difficulty signals.`,
      area: frictionConversations[0].area,
      sourceAgent: frictionConversations[0].agent,
      relatedClients: new Set(frictionConversations.map((conversation) => conversation.clientId)).size,
      priority: "High",
      date: frictionConversations[0].date
    }] : []),
    {
      id: "recommendation-events",
      type: "Finding",
      insight: `${formatNumber(apiSummary.value.recommendationEvents)} recommendation events and ${formatNumber(apiSummary.value.acceptedRecommendations)} accepted recommendations are recorded.`,
      area: "B2B",
      sourceAgent: "AI Feedback",
      relatedClients: apiSummary.value.users,
      priority: "Low",
      date: formatDate(new Date().toISOString())
    }
  ];
};
const loadAdminUsers = async () => {
  adminUsers.value = await apiGet<AdminUser[]>("/api/admin/users");
};
const createAdminUser = async () => {
  adminNotice.value = "";
  try {
    const result = await apiPost<{ user: AdminUser; temporaryPassword: string }>("/api/admin/users", newAdmin.value);
    adminNotice.value = `User created. Temporary password: ${result.temporaryPassword}`;
    newAdmin.value = { name: "", email: "", role: "Viewer", password: "" };
    await loadAdminUsers();
  } catch (error) {
    adminNotice.value = error instanceof Error ? error.message : "Could not create user.";
  }
};
const resetAdminPassword = async (adminId: string) => {
  if (!adminId) return;
  adminNotice.value = "";
  try {
    const result = await apiPost<{ user: AdminUser; temporaryPassword: string }>(`/api/admin/users/${adminId}/reset-password`, {});
    adminNotice.value = `Temporary password for ${result.user.email}: ${result.temporaryPassword}`;
    await loadAdminUsers();
  } catch (error) {
    adminNotice.value = error instanceof Error ? error.message : "Could not reset password.";
  }
};
const loadProductionData = async () => {
  isLoadingData.value = true;
  dashboardError.value = "";
  try {
    const days = daysFromRange();
    const [summary, users] = await Promise.all([
      apiGet<typeof apiSummary.value>(`/api/summary?days=${days}`),
      apiGet<Array<{
        userId: string;
        sessions: number;
        completedSessions: number;
        answers: number;
        lastActivityAt?: string;
        displayName?: string;
        email?: string;
        phone?: string;
        channel?: string;
        deviceName?: string;
        segment?: string;
      }>>(`/api/users?days=${days}`)
    ]);
    apiSummary.value = summary;
    clients.value = users.map((user) => {
      const completed = user.completedSessions > 0;
      return {
        id: user.userId,
        name: user.displayName || user.email || user.phone || user.userId,
        email: user.email || "Unknown",
        phone: user.phone || "Unknown",
        country: user.segment || "Unknown",
        state: user.channel || "Unknown",
        city: user.deviceName || "Unknown",
        interactions: user.answers,
        journey: `${Math.min(9, Math.max(1, user.sessions || 1))}/9`,
        lastAgent: "Personal & Business Baseline Agent",
        lastActivity: formatDate(user.lastActivityAt),
        status: completed ? "Completed" : user.sessions > 0 ? "In progress" : "New",
        piguiBusinessId: user.userId,
        piguiScanId: user.segment || "Unknown",
        piguiRewardsId: user.channel || "Unknown"
      };
    });
    if (!selectedClientId.value && clients.value[0]) selectedClientId.value = clients.value[0].id;
    conversations.value = [];
    await Promise.all(clients.value.slice(0, 25).map((client) => loadClientDetail(client.id)));
    buildInsights();
    await loadAdminUsers();
  } catch (error) {
    dashboardError.value = error instanceof Error ? error.message : "Could not load production data.";
    clients.value = [];
    conversations.value = [];
    insights.value = [];
  } finally {
    isLoadingData.value = false;
  }
};

const selectedClient = computed(() => clients.value.find((client) => client.id === selectedClientId.value));
const selectedConversation = computed(() => conversations.value.find((conversation) => conversation.id === selectedConversationId.value));
const selectedClientConversations = computed(() => conversations.value.filter((conversation) => conversation.clientId === selectedClientId.value));
const authAdminId = computed(() => adminUsers.value.find((admin) => admin.email === settings.value.adminEmail)?.id || adminUsers.value[0]?.id || "");
const showDateSelector = computed(() => route.value === "dashboard" || route.value === "conversations");
const pageTitle = computed(() => {
  if (route.value === "client-detail") return selectedClient.value?.name || "Client";
  if (route.value === "client-conversations") return "Client conversations";
  if (route.value === "transcript") return "Transcript";
  return label(activeNav.value);
});

const agents = computed<Agent[]>(() =>
  agentCatalog.map((agent) => {
    const agentConversations = conversations.value.filter((conversation) => conversation.agent === agent.name);
    return {
      ...agent,
      conversations: agentConversations.length,
      clientsWithActivity: new Set(agentConversations.map((conversation) => conversation.clientId)).size,
      lastActivity: agentConversations[0]?.date || "No activity"
    };
  })
);
const overviewMetrics = computed(() => [
  { title: "Website", value: formatNumber(apiSummary.value.webUsers), detail: "users · Web activity", color: "web" },
  { title: "Pigui Business", value: formatNumber(apiSummary.value.b2bUsers), detail: "users · B2B segment", color: "b2b" },
  { title: "Pigui Scan", value: formatNumber(apiSummary.value.b2oUsers), detail: "users · B2O segment", color: "b2o" },
  { title: "Pigui Rewards", value: formatNumber(apiSummary.value.b2cUsers), detail: "users · B2C segment", color: "b2c" },
  { title: "Clients", value: formatNumber(apiSummary.value.users), detail: "active in selected period" },
  { title: "Pigui Agents", value: formatNumber(agentCatalog.length), detail: "active · Across the ecosystem" },
  { title: "Conversations", value: formatNumber(apiSummary.value.sessions), detail: "sessions · Generated in this period" },
  { title: "Completed Sessions", value: formatNumber(apiSummary.value.completedSessions), detail: "completed · Across the ecosystem" }
]);
const clientMetrics = computed(() => [
  { title: "Clients", value: formatNumber(apiSummary.value.users), detail: "Active users in selected period" },
  { title: "Active clients", value: formatNumber(clients.value.length), detail: "Loaded from production database" },
  { title: "Completed sessions", value: formatNumber(apiSummary.value.completedSessions), detail: "Completed onboarding voice sessions" },
  { title: "Total answers", value: formatNumber(apiSummary.value.answers), detail: "Answers captured in this period" }
]);
const conversationMetrics = computed(() => [
  { title: "Conversations", value: formatNumber(apiSummary.value.sessions), detail: "Sessions generated in this period" },
  { title: "Clients with conversations", value: formatNumber(apiSummary.value.users), detail: "With at least one interaction" },
  { title: "Completed conversations", value: formatNumber(apiSummary.value.completedSessions), detail: "Closed correctly" },
  { title: "Conversations with friction", value: formatNumber(conversations.value.filter((conversation) => conversation.friction === "Yes").length), detail: "With detected friction signals" }
]);
const agentMetrics = computed(() => [
  { title: "Total agents", value: formatNumber(agentCatalog.length), detail: "Available across the ecosystem" },
  { title: "Active agents", value: formatNumber(agents.value.filter((agent) => agent.conversations > 0).length), detail: "With loaded activity" },
  { title: "Conversations", value: formatNumber(apiSummary.value.sessions), detail: "Generated in this period" },
  { title: "Clients with activity", value: formatNumber(apiSummary.value.users), detail: "With agent interaction" }
]);
const insightMetrics = computed(() => [
  { title: "Insights detected", value: formatNumber(insights.value.length), detail: "Generated from loaded conversations" },
  { title: "Frictions detected", value: formatNumber(conversations.value.filter((conversation) => conversation.friction === "Yes").length), detail: "Issues or confusion signals" },
  { title: "Recommendation events", value: formatNumber(apiSummary.value.recommendationEvents), detail: "AI recommendation records" },
  { title: "Clients impacted", value: formatNumber(apiSummary.value.users), detail: "Related to detected insights" }
]);
const insightBlocks = computed(() => [
  { title: "Key findings", items: insights.value.filter((insight) => insight.type === "Finding").map((insight) => insight.insight).slice(0, 3) },
  { title: "Detected frictions", items: insights.value.filter((insight) => insight.type === "Friction").map((insight) => insight.insight).slice(0, 3) },
  { title: "Opportunities", items: insights.value.filter((insight) => insight.type === "Opportunity").map((insight) => insight.insight).slice(0, 3) }
].map((block) => ({ ...block, items: block.items.length ? block.items : ["No production signals loaded yet."] })));

const filteredClients = computed(() => {
  const term = clientSearch.value.toLowerCase().trim();
  if (!term) return clients.value;
  return clients.value.filter((client) => `${client.name} ${client.email} ${client.phone}`.toLowerCase().includes(term));
});
const filteredConversations = computed(() => {
  const term = conversationSearch.value.toLowerCase().trim();
  return conversations.value.filter((conversation) => {
    const matchesTerm = !term || `${conversation.client} ${conversation.agent} ${conversation.area} ${conversation.transcript.map((row) => row.message).join(" ")}`.toLowerCase().includes(term);
    const matchesArea = conversationFilters.value.area === "All areas" || conversation.area === conversationFilters.value.area;
    const matchesAgent = conversationFilters.value.agent === "All agents" || conversation.agent === conversationFilters.value.agent;
    const matchesStatus = conversationFilters.value.status === "All statuses" || conversation.status === conversationFilters.value.status;
    const matchesFriction = conversationFilters.value.friction === "All friction" || conversation.friction === conversationFilters.value.friction;
    return matchesTerm && matchesArea && matchesAgent && matchesStatus && matchesFriction;
  });
});
const filteredAgents = computed(() => {
  const term = agentSearch.value.toLowerCase().trim();
  return agents.value.filter((agent) => {
    const matchesTerm = !term || `${agent.name} ${agent.area} ${agent.type}`.toLowerCase().includes(term);
    const matchesArea = agentFilters.value.area === "All areas" || agent.area === agentFilters.value.area;
    const matchesStatus = agentFilters.value.status === "All statuses" || agent.status === agentFilters.value.status;
    const matchesType = agentFilters.value.type === "All types" || agent.type === agentFilters.value.type;
    return matchesTerm && matchesArea && matchesStatus && matchesType;
  });
});

const goTo = (id: NavId) => {
  activeNav.value = id;
  route.value = id;
  setPath(routePath(id));
};
const openClient = (clientId: string) => {
  selectedClientId.value = clientId;
  activeNav.value = "clients";
  route.value = "client-detail";
  setPath(routePath("client-detail", clientId));
  void loadClientDetail(clientId).then(buildInsights);
};
const openClientConversations = (clientId: string) => {
  selectedClientId.value = clientId;
  activeNav.value = "clients";
  route.value = "client-conversations";
  setPath(routePath("client-conversations", clientId));
  void loadClientDetail(clientId).then(buildInsights);
};
const openTranscript = (conversationId: string) => {
  selectedConversationId.value = conversationId;
  transcriptContext.value = activeNav.value === "clients" ? "clients" : "conversations";
  if (transcriptContext.value === "clients") {
    selectedClientId.value = conversations.value.find((conversation) => conversation.id === conversationId)?.clientId || selectedClientId.value;
  }
  route.value = "transcript";
  setPath(routePath("transcript", conversationId));
};
const downloadTranscript = (conversationId: string) => {
  const conversation = conversations.value.find((item) => item.id === conversationId);
  if (!conversation) return;
  const body = conversation.transcript.map((row) => `${row.timestamp} - ${row.speaker}: ${row.message}`).join("\n");
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${conversation.client}-${conversation.agent}-transcript.txt`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  link.click();
  URL.revokeObjectURL(url);
};
const areaClass = (area: Area) => `area-chip--${area.toLowerCase()}`;
const statusClass = (status: Status) => {
  if (status === "Completed") return "status-chip--completed";
  if (status === "In progress") return "status-chip--progress";
  if (status === "Failed") return "status-chip--failed";
  return "status-chip--new";
};

const ConversationTable = defineComponent({
  props: {
    rows: { type: Array as () => Conversation[], required: true }
  },
  emits: ["transcript", "download"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "table-wrap" }, [
        h("table", [
          h("thead", [
            h("tr", [
              h("th", "Client"),
              h("th", "Agent"),
              h("th", "Area"),
              h("th", "Date"),
              h("th", "Duration"),
              h("th", "Status"),
              h("th", "Friction"),
              h("th", "Actions")
            ])
          ]),
          h(
            "tbody",
            props.rows.map((row) =>
              h("tr", { key: row.id }, [
                h("td", row.client),
                h("td", row.agent),
                h("td", [h("span", { class: ["area-chip", areaClass(row.area)] }, row.area)]),
                h("td", row.date),
                h("td", row.duration),
                h("td", [h("span", { class: ["status-chip", row.status === "Completed" ? "status-chip--completed" : row.status === "Failed" ? "status-chip--failed" : "status-chip--progress"] }, row.status)]),
                h("td", [h("span", { class: ["friction", row.friction === "Yes" ? "friction--yes" : "friction--no"] }, row.friction)]),
                h("td", { class: "actions-cell" }, [
                  h("button", { class: "table-action", type: "button", onClick: () => emit("transcript", row.id) }, "View transcript"),
                  h("button", { class: "table-action table-action--ghost", type: "button", onClick: () => emit("download", row.id) }, "Download")
                ])
              ])
            )
          )
        ])
      ]);
  }
});

const routePath = (nextRoute: Route, id = "") => {
  if (nextRoute === "client-detail") return `/clients/${id || selectedClientId.value}`;
  if (nextRoute === "client-conversations") return `/clients/${id || selectedClientId.value}/conversations`;
  if (nextRoute === "transcript") {
    return transcriptContext.value === "clients"
      ? `/clients/${selectedClientId.value}/conversations/${id || selectedConversationId.value}/transcript`
      : `/conversations/${id || selectedConversationId.value}/transcript`;
  }
  return `/${nextRoute}`;
};

const setPath = (path: string) => {
  window.history.pushState({}, "", path);
};

const signIn = async () => {
  authError.value = "";
  try {
    const result = await apiPost<{
      token: string;
      admin: { id: string; name: string; email: string; role: string };
    }>("/api/auth/sign-in", {
      email: signInEmail.value,
      password: signInPassword.value
    });
    authToken.value = result.token;
    localStorage.setItem("pigui_dashboard_token", result.token);
    settings.value.adminName = result.admin.name;
    settings.value.adminEmail = result.admin.email;
    settings.value.adminRole = result.admin.role;
    isSignedIn.value = true;
    route.value = "dashboard";
    activeNav.value = "dashboard";
    setPath("/dashboard");
    await loadProductionData();
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "Could not sign in.";
  }
};

const syncRouteFromPath = () => {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "sign-in" || parts.length === 0) {
    isSignedIn.value = false;
    route.value = "dashboard";
    activeNav.value = "dashboard";
    return;
  }

  isSignedIn.value = true;
  if (parts[0] === "clients" && parts[1] && parts[2] === "conversations" && parts[3] && parts[4] === "transcript") {
    selectedClientId.value = parts[1];
    selectedConversationId.value = parts[3];
    transcriptContext.value = "clients";
    route.value = "transcript";
    activeNav.value = "clients";
    return;
  }
  if (parts[0] === "clients" && parts[1] && parts[2] === "conversations") {
    selectedClientId.value = parts[1];
    route.value = "client-conversations";
    activeNav.value = "clients";
    return;
  }
  if (parts[0] === "clients" && parts[1]) {
    selectedClientId.value = parts[1];
    route.value = "client-detail";
    activeNav.value = "clients";
    return;
  }
  if (parts[0] === "conversations" && parts[1] && parts[2] === "transcript") {
    selectedConversationId.value = parts[1];
    transcriptContext.value = "conversations";
    route.value = "transcript";
    activeNav.value = "conversations";
    return;
  }
  if (["dashboard", "clients", "conversations", "agents", "insights", "settings"].includes(parts[0])) {
    route.value = parts[0] as NavId;
    activeNav.value = parts[0] as NavId;
  }
};

onMounted(() => {
  syncRouteFromPath();
  if (authToken.value) {
    isSignedIn.value = true;
    void loadProductionData();
  }
  window.addEventListener("popstate", syncRouteFromPath);
});

watch(selectedRange, () => {
  if (isSignedIn.value) void loadProductionData();
});
</script>
