# LEO OS — LeOpUT Full Product Blueprint

## Product definition

LEO OS is an app-like company operating environment. **LeOpUT** (LEO Operating & Utility Terminal) is the primary interaction surface: a centered command/search bar where a user can ask LEO to build, find, analyze, connect, execute, or operate something.

The experience should feel like opening a new mobile operating environment rather than opening a conventional dashboard.

## Core UX

1. Open LEO OS.
2. See the LEO OS home environment with app icons, widgets, notifications and the centered LeOpUT command bar.
3. Type an intent such as `build me a website for my company`.
4. LeOpUT turns the request into a governed plan.
5. Intelligence proposes; policy evaluates; the control plane authorizes; workers execute; audit records important state.
6. The result opens inside LEO OS as an app/workspace, not as an uncontrolled external side effect.
7. Generated work can be saved, resumed, inspected, approved, exported or deployed according to policy.

## Built-in OS surfaces

- LeOpUT — command/search/intent surface
- Home — mobile-like launcher
- Gallery — generated assets, websites, images, documents and project outputs
- App Store / App Library — supported integrations, tools and AI providers
- AI Hub — connected model providers and model capabilities
- Workbench — active builds and tasks
- Objectives — company goals and execution state
- Approvals — human decisions required by policy
- Operations — jobs, workers, queues and runtime state
- Activity — provenance and audit timeline
- Security — identity, permissions, connected accounts, secrets status and policy
- Settings — organization, appearance, notifications and runtime configuration

## App installation model

LEO OS distinguishes three classes:

### 1. Native LEO apps
Built into the OS and available immediately: LeOpUT, Gallery, Workbench, Objectives, Approvals, Operations, Activity, Security and Settings.

### 2. Connectable apps
Apps with an OAuth/OIDC or supported authorization flow. The user chooses **Connect**, completes the provider's official consent/login flow, and LEO OS stores the resulting credentials in the encrypted server-side integration vault. Capabilities are then registered for the organization and remain governed by identity, policy and authorization.

Examples: Google Workspace, Slack, GitHub and future providers.

### 3. AI providers / services
AI systems may be connected as server-side providers or through an account authorization flow. They are exposed through the Intelligence Gateway rather than directly to workers. Provider selection, model routing, fallback, quotas and cost policy remain under LEO OS control.

## Automatic integration contract

`Install/Connect → Authenticate → Consent → Vault → Capability Registry → Policy → Control Plane → Worker`

Connecting an app does **not** automatically grant unrestricted authority. It creates an available capability boundary. Every consequential operation must still pass the existing LEO OS authorization/control path.

## AI and app workers

Any connected AI provider or supported app may become a **worker capability** when its adapter declares supported actions, input/output contracts, limits and risk classification.

Examples:

- AI worker: research, summarize, draft, analyze, classify, plan.
- GitHub worker: inspect repository, create branch, propose change, open PR after authorization.
- Google worker: read mail, draft/send mail after policy approval, inspect calendar, create events after authorization, read/write Drive within granted scope.
- Slack worker: read permitted channels, draft/send messages after authorization.

Workers never become an independent authority. They receive an authorized execution envelope from the control plane and return results plus provenance.

## Website-building example

User enters:

`Build me a website for my new company.`

LeOpUT should:

1. Interpret the intent.
2. Retrieve relevant company context when authorized.
3. Ask only for missing decisions that materially affect the build.
4. Generate a bounded execution plan.
5. Show proposed actions and risk/approval requirements.
6. Execute approved work in the governed worker runtime.
7. Render the result in a LEO OS workspace/app.
8. Save source, assets, provenance and version history to the Gallery/Workbench.
9. Offer preview, revision, export and deployment actions according to policy.

## Architecture law

The LeOpUT UI is **not** the control plane. The App Store is **not** the authorization engine. Connected apps are **not** trusted workers. AI providers are **not** authorities.

The invariant remains:

> INTELLIGENCE MAY PROPOSE. POLICY MAY AUTHORIZE. THE CONTROL PLANE DECIDES. EXECUTORS EXECUTE. LEO OS RECORDS EVERYTHING IMPORTANT.

## Product completion gates

The final product is only called complete after:

- installable app shell is functional;
- authentication and organization context are functional;
- LeOpUT intent flow is functional;
- OS app launcher/navigation is functional;
- Gallery and Workbench are functional;
- App Library connection lifecycle is functional;
- connected-app capabilities reach governed adapters;
- AI providers reach the Intelligence Gateway;
- workers execute only through authorized envelopes;
- approvals, audit and provenance are visible;
- background jobs, retries and recovery work;
- security hardening and tenant isolation are verified;
- deployment packaging and environment configuration are complete;
- end-to-end, regression, adversarial and recovery certification passes.

Certification remains a separate final gate after implementation is complete.
