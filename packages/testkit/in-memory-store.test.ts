import { InMemoryStore } from './in-memory-store';
import { storeContract } from './store-contract';

storeContract('InMemoryStore', () => new InMemoryStore());
