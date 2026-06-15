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
          <select v-model="selectedRange" disabled>
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

        <section class="panel chart-panel">
          <div class="chart-panel__header">
            <div>
              <h2>Business pulse</h2>
              <p>Real production data showing the trend of sessions, answers and completed sessions across the selected 90-day window.</p>
            </div>
            <div class="chart-panel__stats">
              <div>
                <span>Sessions</span>
                <strong>{{ formatNumber(apiSummary.sessions) }}</strong>
              </div>
              <div>
                <span>Answers / session</span>
                <strong>{{ apiSummary.avgAnswersPerSession.toFixed(1) }}</strong>
              </div>
              <div>
                <span>Completion rate</span>
                <strong>{{ pulseSummary.completionRate }}</strong>
              </div>
            </div>
          </div>

          <div class="chart-panel__legend chart-panel__legend--users">
              <span v-for="item in pulseLegend" :key="item.label" class="chart-pill">
                <i class="chart-pill__dot" :style="{ backgroundColor: item.color }" aria-hidden="true"></i>
                {{ item.label }} · {{ item.value }}
              </span>
            </div>

          <div class="chart-panel__chart">
            <ApexChart type="area" height="420" :options="pulseChartOptions" :series="pulseChartSeries" />
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
          <div class="transcript-toolbar">
            <div>
              <h2>Full transcript</h2>
              <p>Use the actions to download the transcript or inspect this conversation on its own.</p>
            </div>
            <div class="transcript-actions">
              <button
                class="secondary-action"
                :class="{ 'secondary-action--active': showTranscriptInsights }"
                type="button"
                @click="toggleTranscriptInsights"
              >
                Insights
              </button>
              <button class="primary-action" type="button" @click="downloadTranscript(selectedConversation.id)">Download transcript</button>
            </div>
          </div>
          <section v-if="showTranscriptInsights" class="transcript-insights">
            <h3>Conversation insights</h3>
            <ul class="transcript-insights__list">
              <li v-for="insight in selectedConversationInsights" :key="insight.id" class="transcript-insight-item">
                <span class="transcript-insight-item__type" :class="`transcript-insight-item__type--${insight.type.toLowerCase()}`">{{ insight.type }}</span>
                <div>
                  <strong>{{ insight.title }}</strong>
                  <p>{{ insight.detail }}</p>
                </div>
              </li>
            </ul>
          </section>
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
              <thead><tr><th>Agent</th><th>Area</th><th>Status</th><th>Type</th><th>Repos</th><th>7-day calls</th><th>Clients with activity</th><th>Conversations</th><th>Last activity</th></tr></thead>
              <tbody>
                <tr
                  v-for="agent in filteredAgents"
                  :key="agent.id"
                  class="agent-row"
                  :class="{ 'agent-row--selected': agent.id === selectedAgentId }"
                  @click="openAgent(agent.id)"
                >
                  <td>{{ agent.name }}</td>
                  <td><span class="area-chip" :class="areaClass(agent.area)">{{ agent.area }}</span></td>
                  <td><span class="status-chip" :class="agent.archived ? 'status-chip--failed' : 'status-chip--completed'">{{ agent.archived ? 'Archived' : agent.status }}</span></td>
                  <td>{{ agent.type }}</td>
                  <td>
                    <span v-if="agent.repoMatches?.length" class="repo-list">
                      <span v-for="repo in agent.repoMatches.slice(0, 2)" :key="repo" class="repo-chip">{{ repo }}</span>
                      <span v-if="agent.repoMatches.length > 2" class="repo-chip repo-chip--more">+{{ agent.repoMatches.length - 2 }}</span>
                    </span>
                    <span v-else class="repo-chip repo-chip--empty">No repo mapped</span>
                  </td>
                  <td>{{ agent.last7DayCallCount ?? 0 }}</td>
                  <td>{{ agent.clientsWithActivity }}</td>
                  <td>{{ agent.conversations }}</td>
                  <td>{{ agent.lastActivity }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section v-if="selectedAgent" class="panel agent-detail-panel">
          <div class="table-toolbar">
            <div>
              <h2>{{ selectedAgent.name }}</h2>
              <p>{{ selectedAgent.purpose }}</p>
            </div>
            <div class="agent-detail-meta">
              <span class="repo-chip" v-for="repo in (selectedAgent.repoMatches || []).slice(0, 3)" :key="repo">{{ repo }}</span>
            </div>
          </div>
          <div class="metric-row">
            <article class="stat-card">
              <span>7-day calls</span>
              <strong>{{ selectedAgent.last7DayCallCount ?? 0 }}</strong>
              <p>Live activity from ElevenLabs</p>
            </article>
            <article class="stat-card">
              <span>Responses</span>
              <strong>{{ selectedAgentResponseCount }}</strong>
              <p>Recent recommendation events</p>
            </article>
            <article class="stat-card">
              <span>Accepted</span>
              <strong>{{ selectedAgentAcceptedCount }}</strong>
              <p>Responses marked as accepted</p>
            </article>
            <article class="stat-card">
              <span>Last activity</span>
              <strong>{{ selectedAgent.lastCallAt || "No activity" }}</strong>
              <p>{{ selectedAgent.trustContext || "unknown" }}</p>
            </article>
          </div>
          <div v-if="isLoadingAgentResponses" class="data-alert data-alert--loading">Loading agent responses...</div>
          <div v-else-if="!selectedAgentResponses.length" class="data-alert">No responses found yet for this agent.</div>
          <div v-else class="agent-response-list">
            <article v-for="response in selectedAgentResponses" :key="response.id" class="agent-response-card">
              <div class="agent-response-card__header">
                <strong>{{ response.title || response.responseText || "Agent response" }}</strong>
                <span class="status-chip" :class="response.accepted ? 'status-chip--completed' : 'status-chip--progress'">
                  {{ response.accepted ? "Accepted" : "Pending" }}
                </span>
              </div>
              <p>{{ response.responseText || response.feedback || "No response text available." }}</p>
              <div class="agent-response-card__meta">
                <span v-if="response.goal">{{ response.goal }}</span>
                <span v-if="response.rewardType">{{ response.rewardType }}</span>
                <span v-if="response.rewardAlgorithm">{{ response.rewardAlgorithm }}</span>
                <span>{{ formatDate(response.createdAt) }}</span>
              </div>
            </article>
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
        <section class="panel admin-profile-panel">
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
        <section class="panel integrations-panel">
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
import "apexcharts/violin";
import ApexChart from "vue3-apexcharts";
import type { ApexOptions } from "apexcharts";
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
  segment?: string;
  state: string;
  city: string;
  sessions: number;
  completedSessions: number;
  interactions: number;
  journey: string;
  lastAgent: string;
  lastActivity: string;
  lastActivityAt?: string;
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
  repoMatches?: string[];
  lastCallAt?: string;
  last7DayCallCount?: number;
  archived?: boolean;
  trustContext?: string;
};

type ElevenLabsAgent = {
  agentId: string;
  name: string;
  tags: string[];
  createdAtUnixSecs?: number;
  lastCallTimeUnixSecs?: number | null;
  archived?: boolean;
  last7DayCallCount?: number;
  hasCoaching?: boolean;
  trustContext?: string;
  repoMatches?: string[];
};

type AgentResponse = {
  id: string;
  branchId?: string;
  businessId?: string | null;
  agentId: string;
  conversationId?: string | null;
  recommendationId?: string | null;
  accepted: boolean;
  feedback?: string | null;
  responseText?: string | null;
  conversationSummary?: string | null;
  aiPrompt?: string | null;
  goal?: string | null;
  goalDescription?: string | null;
  rewardType?: string | null;
  rewardAlgorithm?: string | null;
  rewardKind?: string | null;
  subtype?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string;
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
type ConversationInsight = {
  id: string;
  type: "Finding" | "Friction" | "Opportunity";
  title: string;
  detail: string;
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

type DistributionGroup = {
  label: string;
  color: string;
  total: number;
};

const distributionPalette = ["#2563eb", "#8b5cf6", "#06b6d4", "#f97316", "#10b981", "#ef4444"];

const hashToJitter = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return (normalized - 0.5) * 0.42;
};

const percentile = (values: number[], quantile: number) => {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];
  const position = (values.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (position - lower);
};

const buildDensity = (values: number[]): Array<[number, number]> => {
  if (!values.length) return [];

  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 1) {
    const center = sorted[0];
    return [
      [Math.max(0, center - 1), 0],
      [center, 1],
      [center + 1, 0]
    ];
  }

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const span = Math.max(max - min, 1);
  const bandwidth = Math.max(span / Math.max(sorted.length, 5), 2);
  const sampleCount = 28;
  const density: Array<[number, number]> = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const x = min + (span * index) / (sampleCount - 1);
    const weight = sorted.reduce((sum, value) => {
      const scaled = (x - value) / bandwidth;
      return sum + Math.exp(-0.5 * scaled * scaled);
    }, 0);
    density.push([x, weight]);
  }

  const maxWeight = Math.max(...density.map((entry) => entry[1]), 1);
  return density.map(([x, weight]) => [x, Number((weight / maxWeight).toFixed(4))]);
};

const isSignedIn = ref(false);
const signInEmail = ref("admin@pigui.ai");
const signInPassword = ref("");
const route = ref<Route>("dashboard");
const activeNav = ref<NavId>("dashboard");
const selectedRange = ref("Last 90 days");
const selectedClientId = ref("");
const selectedConversationId = ref("");
const transcriptContext = ref<"clients" | "conversations">("conversations");
const showTranscriptInsights = ref(false);
const clientSearch = ref("");
const conversationSearch = ref("");
const agentSearch = ref("");
const selectedAgentId = ref("");
const selectedAgentResponses = ref<AgentResponse[]>([]);
const isLoadingAgentResponses = ref(false);
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
const businessPulsePoints = computed(() => {
  const bucketMap = new Map<number, { startDate: Date; sessions: number; answers: number; completedSessions: number }>();
  const current = new Date();
  const today = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  for (let index = 12; index >= 0; index -= 1) {
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - index * 7);
    bucketMap.set(index, { startDate, sessions: 0, answers: 0, completedSessions: 0 });
  }
  for (const client of clients.value) {
    if (!client.lastActivityAt) continue;
    const activityDate = new Date(client.lastActivityAt);
    if (Number.isNaN(activityDate.getTime())) continue;
    const activityDay = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
    const diffMs = today.getTime() - activityDay.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 90) continue;
    const bucketIndex = Math.min(12, Math.floor(diffDays / 7));
    const bucket = bucketMap.get(bucketIndex);
    if (!bucket) continue;
    bucket.sessions += Number(client.sessions || 0);
    bucket.answers += Number(client.interactions || 0);
    bucket.completedSessions += Number(client.completedSessions || 0);
  }
  return [...bucketMap.values()].map((values) => ({
    date: values.startDate.toISOString().slice(0, 10),
    ...values
  }));
});
const pulseLegend = computed(() => [
  { label: "Sessions", value: formatNumber(apiSummary.value.sessions), color: "#2563eb" },
  { label: "Answers", value: formatNumber(apiSummary.value.answers), color: "#8b5cf6" },
  { label: "Completed", value: formatNumber(apiSummary.value.completedSessions), color: "#10b981" }
]);
const pulseSummary = computed(() => {
  const completionRate = apiSummary.value.sessions > 0 ? `${Math.round((apiSummary.value.completedSessions / apiSummary.value.sessions) * 100)}%` : "0%";
  return { completionRate };
});
const pulseChartSeries = computed(() => {
  const points = businessPulsePoints.value;
  return [
    {
      name: "Sessions",
      data: points.map((point) => point.sessions)
    },
    {
      name: "Answers",
      data: points.map((point) => point.answers)
    },
    {
      name: "Completed",
      data: points.map((point) => point.completedSessions)
    }
  ];
});
const pulseChartOptions = computed<ApexOptions>(() => {
  const labels = businessPulsePoints.value.map((point) => new Date(`${point.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  return {
    chart: {
      type: "area",
      height: 420,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 850,
        dynamicAnimation: {
          enabled: true,
          speed: 850
        }
      },
      foreColor: "#5b6b84",
      background: "transparent"
    },
    colors: ["#2563eb", "#8b5cf6", "#10b981"],
    dataLabels: { enabled: false },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
      fontWeight: 700,
      labels: { colors: "#44546b" }
    },
    stroke: {
      curve: "smooth",
      width: [3, 3, 3]
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0.22,
        opacityFrom: 0.26,
        opacityTo: 0.03,
        stops: [0, 100]
      }
    },
    grid: {
      borderColor: "#e3ebf5",
      strokeDashArray: 5,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: "#6c7a92",
          fontSize: "12px",
          fontWeight: 600
        },
        rotate: 0,
        rotateAlways: false
      }
    },
    yaxis: {
      min: 0,
      labels: {
        style: {
          colors: "#6c7a92"
        }
      }
    },
    tooltip: {
      theme: "light",
      shared: true,
      intersect: false
    }
  };
});
const conversationFilters = ref({ area: "All areas", agent: "All agents", status: "All statuses", friction: "All friction" });
const agentFilters = ref({ area: "All areas", status: "All statuses", type: "All types" });
const dateRanges = ["Last 90 days"];
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
  defaultDateRange: "Last 90 days",
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

const USE_DEMO_DATA = false;
const demoClients: Client[] = [
  { id: "sergio-romero", name: "Sergio Romero", email: "sergio.romero@acme.com", phone: "+52 55 1234 5678", country: "Mexico", state: "Mexico City", city: "Mexico City", sessions: 9, completedSessions: 9, interactions: 128, journey: "9/9", lastAgent: "Personal & Business Baseline Agent", lastActivity: "08 Jun 2026, 10:24", lastActivityAt: "2026-06-08T10:24:00Z", status: "Completed", piguiBusinessId: "PB-1001", piguiScanId: "PS-4301", piguiRewardsId: "PR-9001" },
  { id: "ana-torres", name: "Ana Torres", email: "ana.torres@northstar.com", phone: "+1 512 555 0102", country: "United States", state: "Texas", city: "Austin", sessions: 7, completedSessions: 6, interactions: 86, journey: "7/9", lastAgent: "Rewards Feedback Agent", lastActivity: "Today, 10:42", lastActivityAt: "2026-06-11T10:42:00Z", status: "In progress", piguiBusinessId: "PB-1002", piguiScanId: "PS-4302", piguiRewardsId: "PR-9002" },
  { id: "carlos-mendez", name: "Carlos Mendez", email: "carlos.mendez@local.mx", phone: "+52 81 5555 1234", country: "Mexico", state: "Nuevo Leon", city: "Monterrey", sessions: 6, completedSessions: 5, interactions: 74, journey: "6/9", lastAgent: "Consumer Baseline Agent", lastActivity: "Today, 09:58", lastActivityAt: "2026-06-11T09:58:00Z", status: "In progress", piguiBusinessId: "PB-1003", piguiScanId: "PS-4303", piguiRewardsId: "PR-9003" },
  { id: "mariana-lopez", name: "Mariana Lopez", email: "mariana.lopez@retail.co", phone: "+52 33 1234 9090", country: "Mexico", state: "Jalisco", city: "Guadalajara", sessions: 5, completedSessions: 4, interactions: 65, journey: "5/9", lastAgent: "Dashboard Financial Agent", lastActivity: "Yesterday, 18:10", lastActivityAt: "2026-06-10T18:10:00Z", status: "In progress", piguiBusinessId: "PB-1004", piguiScanId: "PS-4304", piguiRewardsId: "PR-9004" },
  { id: "roberto-cruz", name: "Roberto Cruz", email: "roberto.cruz@services.io", phone: "+1 312 555 0144", country: "United States", state: "Illinois", city: "Chicago", sessions: 3, completedSessions: 2, interactions: 54, journey: "3/9", lastAgent: "Onboarding Feedback Agent", lastActivity: "Yesterday, 16:55", lastActivityAt: "2026-06-10T16:55:00Z", status: "New", piguiBusinessId: "PB-1005", piguiScanId: "PS-4305", piguiRewardsId: "PR-9005" },
  { id: "sofia-herrera", name: "Sofia Herrera", email: "sofia.herrera@coffee.us", phone: "+1 602 555 0182", country: "United States", state: "Arizona", city: "Phoenix", sessions: 9, completedSessions: 9, interactions: 92, journey: "9/9", lastAgent: "Feedback Overview Agent", lastActivity: "07 Jun 2026, 14:08", lastActivityAt: "2026-06-07T14:08:00Z", status: "Completed", piguiBusinessId: "PB-1006", piguiScanId: "PS-4306", piguiRewardsId: "PR-9006" },
  { id: "diego-martinez", name: "Diego Martinez", email: "diego.martinez@growth.ai", phone: "+52 55 9988 2211", country: "Mexico", state: "Mexico City", city: "Mexico City", sessions: 4, completedSessions: 3, interactions: 49, journey: "4/9", lastAgent: "Operative Branch Agent", lastActivity: "06 Jun 2026, 11:21", lastActivityAt: "2026-06-06T11:21:00Z", status: "In progress", piguiBusinessId: "PB-1007", piguiScanId: "PS-4307", piguiRewardsId: "PR-9007" },
  { id: "laura-jimenez", name: "Laura Jimenez", email: "laura.jimenez@wellness.com", phone: "+1 415 555 0198", country: "United States", state: "California", city: "San Francisco", sessions: 2, completedSessions: 1, interactions: 43, journey: "2/9", lastAgent: "Personal & Business Baseline Agent", lastActivity: "05 Jun 2026, 09:18", lastActivityAt: "2026-06-05T09:18:00Z", status: "New", piguiBusinessId: "PB-1008", piguiScanId: "PS-4308", piguiRewardsId: "PR-9008" },
  { id: "jorge-ramirez", name: "Jorge Ramirez", email: "jorge.ramirez@market.mx", phone: "+52 55 4488 7711", country: "Mexico", state: "Puebla", city: "Puebla", sessions: 8, completedSessions: 7, interactions: 38, journey: "8/9", lastAgent: "Scan Feedback Agent", lastActivity: "04 Jun 2026, 17:40", lastActivityAt: "2026-06-04T17:40:00Z", status: "In progress", piguiBusinessId: "PB-1009", piguiScanId: "PS-4309", piguiRewardsId: "PR-9009" },
  { id: "paola-sanchez", name: "Paola Sanchez", email: "paola.sanchez@beauty.mx", phone: "+52 33 8877 2211", country: "Mexico", state: "Jalisco", city: "Zapopan", sessions: 1, completedSessions: 1, interactions: 31, journey: "1/9", lastAgent: "Website Agent", lastActivity: "02 Jun 2026, 12:33", lastActivityAt: "2026-06-02T12:33:00Z", status: "New", piguiBusinessId: "PB-1010", piguiScanId: "PS-4310", piguiRewardsId: "PR-9010" }
];
const demoTranscript = (client: string): TranscriptRow[] => [
  { timestamp: "00:00", speaker: "Pigui", message: `Hello ${client}, thanks for your time. I will ask a few quick questions to understand your experience.` },
  { timestamp: "00:28", speaker: client, message: "Hi, I am evaluating Pigui for my business and want to understand how it helps customers." },
  { timestamp: "01:02", speaker: "Pigui", message: "Thank you. What part of the experience felt clearest so far?" },
  { timestamp: "01:38", speaker: client, message: "The dashboard is clear, but I needed more guidance after scanning the QR." },
  { timestamp: "02:14", speaker: "Pigui", message: "That is helpful feedback. I will take that into account for the product team." }
];
const demoConversations: Conversation[] = demoClients.flatMap((client, index) =>
  agentCatalog.slice(0, Math.min(9, index % 9 + 1)).map((agent, agentIndex) => ({
    id: `${client.id}-${agent.id}`,
    clientId: client.id,
    client: client.name,
    agent: agent.name,
    area: agent.area,
    date: agentIndex % 2 === 0 ? "08 Jun 2026, 10:24" : "Today, 10:42",
    duration: `${Math.max(2, agentIndex + 2)}m ${String((agentIndex + 1) * 7).padStart(2, "0")}s`,
    status: agentIndex % 8 === 0 && index > 4 ? "In progress" : "Completed",
    friction: (agentIndex + index) % 4 === 0 ? "Yes" : "No",
    transcript: demoTranscript(client.name)
  }))
);
const demoInsights = [
  { id: "i1", type: "Finding", insight: "B2B concentrates most conversation activity.", area: "B2B" as Area, sourceAgent: "Personal & Business Baseline Agent", relatedClients: 127, priority: "Medium", date: "08 Jun 2026" },
  { id: "i2", type: "Friction", insight: "Some customers do not understand why baseline questions are needed.", area: "B2B" as Area, sourceAgent: "Onboarding Feedback Agent", relatedClients: 42, priority: "High", date: "08 Jun 2026" },
  { id: "i3", type: "Opportunity", insight: "Improve the transition from Pigui Business to Pigui Scan.", area: "B2O" as Area, sourceAgent: "Scan Feedback Agent", relatedClients: 36, priority: "Medium", date: "07 Jun 2026" },
  { id: "i4", type: "Friction", insight: "Rewards redemption flow needs clearer explanation.", area: "B2C" as Area, sourceAgent: "Rewards Feedback Agent", relatedClients: 29, priority: "High", date: "07 Jun 2026" },
  { id: "i5", type: "Finding", insight: "Feedback Overview helps consolidate signals from Business, Scan and Rewards.", area: "B2B" as Area, sourceAgent: "Feedback Overview Agent", relatedClients: 64, priority: "Low", date: "06 Jun 2026" }
];

const clients = ref<Client[]>([]);
const conversations = ref<Conversation[]>([]);
const elevenLabsAgents = ref<ElevenLabsAgent[]>([]);
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
  if (selectedRange.value === "Last 90 days") return 90;
  return 90;
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
  if (normalized.includes("customer") && normalized.includes("baseline")) return agentCatalog[5];
  if (normalized.includes("consumer") || normalized.includes("reward")) return agentCatalog[5];
  if (normalized.includes("scan") || normalized.includes("qr")) return agentCatalog[7];
  if (normalized.includes("financial") || normalized.includes("dashboard")) return agentCatalog[4];
  if (normalized.includes("branch") || normalized.includes("operative")) return agentCatalog[3];
  if (normalized.includes("feedback") || normalized.includes("friction") || normalized.includes("confus")) return agentCatalog[2];
  if (normalized.includes("website") || normalized.includes("web")) return agentCatalog[0];
  return agentCatalog[1];
};
const formatUnixDate = (value?: number | null) => {
  if (!value) return "No activity";
  return formatDate(new Date(value * 1000).toISOString());
};
const buildAgentFromElevenLabs = (agent: ElevenLabsAgent, index: number): Agent => {
  const template = inferAgent(agent.name);
  const step = template.step || String(index + 1).padStart(2, "0");
  return {
    ...template,
    id: agent.agentId,
    step,
    name: agent.name,
    status: "Active",
    conversations: 0,
    clientsWithActivity: 0,
    lastActivity: formatUnixDate(agent.lastCallTimeUnixSecs),
    purpose: template.purpose,
    repoMatches: agent.repoMatches || [],
    lastCallAt: formatUnixDate(agent.lastCallTimeUnixSecs),
    last7DayCallCount: agent.last7DayCallCount || 0,
    archived: Boolean(agent.archived),
    trustContext: agent.trustContext || "unknown"
  };
};
const buildTranscript = (answers: Array<{ question?: string; answer?: string; order?: number }>, clientName: string): TranscriptRow[] =>
  answers.flatMap((answer, index) => {
    const timestamp = String(index + 1).padStart(2, "0");
    return [
      { timestamp: `${timestamp}:00`, speaker: "Pigui", message: answer.question || "Question not available" },
      { timestamp: `${timestamp}:30`, speaker: clientName, message: answer.answer || "No answer captured" }
    ];
  });
const loadAgentResponses = async (agentId: string) => {
  if (USE_DEMO_DATA) {
    selectedAgentResponses.value = [];
    return;
  }
  if (!agentId) {
    selectedAgentResponses.value = [];
    return;
  }
  isLoadingAgentResponses.value = true;
  try {
    const result = await apiGet<{ agentId: string; count: number; acceptedCount: number; responses: AgentResponse[] }>(
      `/api/elevenlabs/agents/${agentId}/responses?limit=12`
    );
    selectedAgentResponses.value = result.responses || [];
  } catch (error) {
    selectedAgentResponses.value = [];
    if (error instanceof Error) {
      dashboardError.value = dashboardError.value || error.message;
    }
  } finally {
    isLoadingAgentResponses.value = false;
  }
};
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
  if (USE_DEMO_DATA) return;
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

const normalizeTranscriptText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u017f\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildConversationInsights = (conversation?: Conversation | null): ConversationInsight[] => {
  if (!conversation) return [];

  const transcript = conversation.transcript || [];
  if (!transcript.length) {
    return [
      {
        id: `${conversation.id}-empty`,
        type: "Finding",
        title: "No transcript content",
        detail: "This conversation has no transcript rows loaded yet."
      }
    ];
  }

  const piguiTurns = transcript.filter((row) => row.speaker === "Pigui").length;
  const clientTurns = transcript.length - piguiTurns;
  const clientMessages = transcript.filter((row) => row.speaker !== "Pigui").map((row) => row.message);
  const piguiMessages = transcript.filter((row) => row.speaker === "Pigui").map((row) => row.message);
  const allText = normalizeTranscriptText(transcript.map((row) => row.message).join(" "));

  const themeRules = [
    { keywords: ["price", "cost", "money", "payment", "fee", "discount"], label: "pricing" },
    { keywords: ["problem", "issue", "error", "bug", "fail", "not working", "doesn't", "doesnt"], label: "friction" },
    { keywords: ["help", "how", "explain", "clarify", "understand"], label: "clarity" },
    { keywords: ["buy", "purchase", "order", "redeem", "claim"], label: "conversion" },
    { keywords: ["business", "company", "branch", "store", "customer"], label: "business context" }
  ];

  const topTheme = themeRules
    .map((rule) => ({
      label: rule.label,
      score: rule.keywords.reduce((sum, keyword) => sum + (allText.includes(keyword) ? 1 : 0), 0)
    }))
    .sort((left, right) => right.score - left.score)[0];
  const longestClientMessage = [...clientMessages].sort((left, right) => right.length - left.length)[0] || "";
  const clientQuestionCount = clientMessages.filter((message) => message.includes("?")).length;
  const frictionSignals = transcript.filter((row) =>
    /problem|issue|error|bug|confus|stuck|doesn'?t|no entiendo|not clear|frustrat/i.test(row.message)
  ).length;

  const insights: ConversationInsight[] = [
    {
      id: `${conversation.id}-balance`,
      type: "Finding",
      title: "Conversation balance",
      detail: `This transcript contains ${clientTurns} client turns and ${piguiTurns} Pigui turns.`
    },
    {
      id: `${conversation.id}-theme`,
      type: "Finding",
      title: "Main theme",
      detail: topTheme?.score ? `The strongest signal is around ${topTheme.label}.` : "No dominant theme was detected from the transcript text."
    }
  ];

  if (clientQuestionCount > 0 || frictionSignals > 0) {
    insights.push({
      id: `${conversation.id}-friction`,
      type: "Friction",
      title: "Potential friction",
      detail: frictionSignals > 0
        ? `The transcript includes ${frictionSignals} signal${frictionSignals === 1 ? "" : "s"} of confusion or friction.`
        : `The client asked ${clientQuestionCount} direct question${clientQuestionCount === 1 ? "" : "s"}, which may need a clearer handoff or explanation.`
    });
  } else {
    insights.push({
      id: `${conversation.id}-friction`,
      type: "Opportunity",
      title: "Low-friction flow",
      detail: "No obvious friction keywords were detected in this conversation."
    });
  }

  if (longestClientMessage.length >= 120) {
    insights.push({
      id: `${conversation.id}-depth`,
      type: "Opportunity",
      title: "Deep customer context",
      detail: `The longest client response is ${longestClientMessage.length} characters, which suggests enough detail to extract richer follow-up actions.`
    });
  } else if (piguiMessages.some((message) => message.length > 140)) {
    insights.push({
      id: `${conversation.id}-depth`,
      type: "Opportunity",
      title: "High agent verbosity",
      detail: "Some Pigui responses are long, so there may be room to tighten the flow and shorten the path to the next question."
    });
  } else {
    insights.push({
      id: `${conversation.id}-depth`,
      type: "Opportunity",
      title: "Move to action",
      detail: "This conversation appears concise enough to turn into a next-step recommendation or follow-up."
    });
  }

  return insights;
};
const loadAdminUsers = async () => {
  if (USE_DEMO_DATA && !authToken.value) {
    adminUsers.value = [{
      id: "admin-demo",
      name: settings.value.adminName,
      email: settings.value.adminEmail,
      role: settings.value.adminRole,
      mustResetPassword: false,
      isActive: true
    }];
    return;
  }
  if (!authToken.value) {
    adminUsers.value = [];
    return;
  }
  try {
    adminUsers.value = await apiGet<AdminUser[]>("/api/admin/users");
  } catch (error) {
    adminUsers.value = [];
    if (error instanceof Error && /unauthorized/i.test(error.message)) {
      authToken.value = "";
      localStorage.removeItem("pigui_dashboard_token");
      return;
    }
    if (route.value === "settings") {
      adminNotice.value = error instanceof Error ? error.message : "Could not load admin users.";
    }
  }
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
    if (USE_DEMO_DATA) {
      apiSummary.value = {
        users: 500,
        sessions: 4820,
        completedSessions: 4215,
        answers: 12840,
        avgAnswersPerSession: 2.7,
        recommendationEvents: 128,
        acceptedRecommendations: 91,
        webUsers: 430,
        mobileUsers: 320,
        b2bUsers: 310,
        b2cUsers: 180,
        b2oUsers: 120
      };
      clients.value = [...demoClients];
      conversations.value = [...demoConversations];
      insights.value = [...demoInsights];
      if (!selectedClientId.value && clients.value[0]) selectedClientId.value = clients.value[0].id;
      await loadAdminUsers();
      return;
    }
    const days = daysFromRange();
    const [summary, users, agentDirectory] = await Promise.all([
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
      }>>(`/api/users?days=${days}`),
      apiGet<{ agents: ElevenLabsAgent[] }>("/api/elevenlabs/agents").catch(() => ({ agents: [] }))
    ]);
    apiSummary.value = summary;
    elevenLabsAgents.value = agentDirectory.agents || [];
    if (!selectedAgentId.value || !activeAgentCatalog.value.some((agent) => agent.id === selectedAgentId.value)) {
      selectedAgentId.value = activeAgentCatalog.value[0]?.id || "";
    }
    if (selectedAgentId.value) {
      await loadAgentResponses(selectedAgentId.value);
    } else {
      selectedAgentResponses.value = [];
    }
    clients.value = users.map((user) => {
      const completed = user.completedSessions > 0;
      return {
        id: user.userId,
        name: user.displayName || user.email || user.phone || user.userId,
        email: user.email || "Unknown",
        phone: user.phone || "Unknown",
        country: user.segment || "Unknown",
        segment: user.segment || "Sin segmento",
        state: user.channel || "Unknown",
        city: user.deviceName || "Unknown",
        sessions: user.sessions || 0,
        completedSessions: user.completedSessions || 0,
        interactions: user.answers,
        journey: `${Math.min(9, Math.max(1, user.sessions || 1))}/9`,
        lastAgent: "Personal & Business Baseline Agent",
        lastActivity: formatDate(user.lastActivityAt),
        lastActivityAt: user.lastActivityAt,
        status: completed ? "Completed" : user.sessions > 0 ? "In progress" : "New",
        piguiBusinessId: user.userId,
        piguiScanId: user.segment || "Unknown",
        piguiRewardsId: user.channel || "Unknown"
      };
    });
    if (!selectedClientId.value && clients.value[0]) selectedClientId.value = clients.value[0].id;
    conversations.value = [];
    await Promise.allSettled(clients.value.slice(0, 25).map((client) => loadClientDetail(client.id)));
    buildInsights();
    void loadAdminUsers();
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
const selectedConversationInsights = computed(() => buildConversationInsights(selectedConversation.value));
const selectedClientConversations = computed(() => conversations.value.filter((conversation) => conversation.clientId === selectedClientId.value));
const selectedAgent = computed(() => activeAgentCatalog.value.find((agent) => agent.id === selectedAgentId.value));
const selectedAgentResponseCount = computed(() => selectedAgentResponses.value.length);
const selectedAgentAcceptedCount = computed(() => selectedAgentResponses.value.filter((response) => response.accepted).length);
const authAdminId = computed(() => adminUsers.value.find((admin) => admin.email === settings.value.adminEmail)?.id || adminUsers.value[0]?.id || "");
const showDateSelector = computed(() => route.value === "dashboard" || route.value === "conversations");
const pageTitle = computed(() => {
  if (route.value === "client-detail") return selectedClient.value?.name || "Client";
  if (route.value === "client-conversations") return "Client conversations";
  if (route.value === "transcript") return "Transcript";
  return label(activeNav.value);
});

const activeAgentCatalog = computed<Agent[]>(() =>
  elevenLabsAgents.value.length
    ? elevenLabsAgents.value.map((agent, index) => buildAgentFromElevenLabs(agent, index))
    : agentCatalog
);

const agents = computed<Agent[]>(() =>
  activeAgentCatalog.value.map((agent) => {
    const agentConversations = conversations.value.filter((conversation) => conversation.agent === agent.name);
    return {
      ...agent,
      conversations: agentConversations.length,
      clientsWithActivity: new Set(agentConversations.map((conversation) => conversation.clientId)).size,
      lastActivity: agentConversations[0]?.date || agent.lastActivity || "No activity"
    };
  })
);
const overviewMetrics = computed(() => [
  { title: "Website", value: formatNumber(apiSummary.value.webUsers), detail: "users · Web activity", color: "web" },
  { title: "Pigui Business", value: formatNumber(apiSummary.value.b2bUsers), detail: "users · B2B segment", color: "b2b" },
  { title: "Pigui Scan", value: formatNumber(apiSummary.value.b2oUsers), detail: "users · B2O segment", color: "b2o" },
  { title: "Pigui Rewards", value: formatNumber(apiSummary.value.b2cUsers), detail: "users · B2C segment", color: "b2c" },
  { title: "Clients", value: formatNumber(apiSummary.value.users), detail: "active in selected period" },
  { title: "Pigui Agents", value: formatNumber(activeAgentCatalog.value.length), detail: "active · Across the ecosystem" },
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
  { title: "Total agents", value: formatNumber(activeAgentCatalog.value.length), detail: "Available across the ecosystem" },
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
    const matchesTerm = !term || `${agent.name} ${agent.area} ${agent.type} ${(agent.repoMatches || []).join(" ")}`.toLowerCase().includes(term);
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
  if (id === "settings") void loadAdminUsers();
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
const openAgent = (agentId: string) => {
  selectedAgentId.value = agentId;
  void loadAgentResponses(agentId);
};
const openTranscript = (conversationId: string) => {
  selectedConversationId.value = conversationId;
  transcriptContext.value = activeNav.value === "clients" ? "clients" : "conversations";
  showTranscriptInsights.value = false;
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
const toggleTranscriptInsights = () => {
  showTranscriptInsights.value = !showTranscriptInsights.value;
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
    if (USE_DEMO_DATA && signInEmail.value.trim().toLowerCase() === "admin@pigui.ai") {
      authToken.value = "";
      localStorage.removeItem("pigui_dashboard_token");
      settings.value.adminName = "Dante Kurai";
      settings.value.adminEmail = "admin@pigui.ai";
      settings.value.adminRole = "Administrator";
      isSignedIn.value = true;
      route.value = "dashboard";
      activeNav.value = "dashboard";
      setPath("/dashboard");
      await loadProductionData();
      return;
    }
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
    showTranscriptInsights.value = false;
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
    showTranscriptInsights.value = false;
    return;
  }
  if (["dashboard", "clients", "conversations", "agents", "insights", "settings"].includes(parts[0])) {
    route.value = parts[0] as NavId;
    activeNav.value = parts[0] as NavId;
  }
};

onMounted(() => {
  syncRouteFromPath();
  if (!window.location.pathname.startsWith("/sign-in")) void loadProductionData();
  window.addEventListener("popstate", syncRouteFromPath);
});

watch(selectedRange, () => {
  if (isSignedIn.value) void loadProductionData();
});
</script>
