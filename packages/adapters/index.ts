// Adapters implement the ports in @scout/core/ports. Each folder arrives with its story:
//   sources/  GitHubListSource (#5), GreenhouseSource, LeverSource, AshbySource (#6)
//   readers/  GreenhouseApiReader (#14), LeverPageReader (#15)
//   store/    FirestoreStore (#2)
//   notify/   MacNotifier, PushNotifier (#12)
//   llm/      ClaudeTriage (#9), ClaudePlanner (#17)
export { connectFirestore } from './store/connect';
export { clearEmulator, emulatorFirestore } from './store/emulator';
export { FirestoreStore, fromFirestore } from './store/firestore-store';
