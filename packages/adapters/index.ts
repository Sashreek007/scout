// Adapters implement the ports in @scout/core/ports. Each folder arrives with its story:
//   sources/  GitHubListSource (#5), GreenhouseSource, LeverSource, AshbySource (#6)
//   readers/  GreenhouseApiReader (#14), LeverPageReader (#15)
//   store/    FirestoreStore (#2)
//   notify/   MacNotifier, PushNotifier (#12)
//   llm/      ClaudeTriage (#9), ClaudePlanner (#17)
export { HttpError, USER_AGENT, createHttpClient, type HttpClient } from './http/http-client';
export { createLinkResolver, type LinkResolver } from './http/link-resolver';
export {
  GitHubListSource,
  type GitHubListConfig,
  type GitHubListDeps,
} from './sources/github-list-source';
export { AshbySource } from './sources/ashby-source';
export {
  BOARD_REQUESTS,
  BoardSource,
  type BoardFeed,
  type BoardPosting,
  type BoardSourceDeps,
} from './sources/board-source';
export { createBoardSources, type BoardSourcesOptions } from './sources/create-board-sources';
export { GreenhouseSource } from './sources/greenhouse-source';
export { LeverSource } from './sources/lever-source';
export { createLimiter, type Limiter } from './sources/limiter';
export { connectFirestore } from './store/connect';
export { clearEmulator, emulatorFirestore } from './store/emulator';
export { FirestoreStore, fromFirestore } from './store/firestore-store';
export { ClaudeTriage, type ClaudeTriageOptions } from './llm/claude-triage';
export { createClaudeClient } from './llm/client';
