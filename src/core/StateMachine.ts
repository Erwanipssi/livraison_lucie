export type AppState =
  | 'LOADING'
  | 'DELIVERY'
  | 'OPENING'
  | 'BLOOMING'
  | 'BOUQUET'
  | 'LETTER'
  | 'COMPLETED';

const TRANSITIONS: Record<AppState, AppState[]> = {
  LOADING: ['DELIVERY'],
  DELIVERY: ['OPENING'],
  OPENING: ['BLOOMING'],
  BLOOMING: ['BOUQUET'],
  BOUQUET: ['LETTER'],
  LETTER: ['BOUQUET', 'COMPLETED'],
  COMPLETED: ['BOUQUET', 'LETTER', 'DELIVERY'],
};

type Listener = (to: AppState, from: AppState) => void;

/**
 * Machine à états stricte : refuse les transitions incohérentes et les
 * doubles déclenchements (via `busy`, posé pendant les séquences animées).
 */
export class StateMachine {
  state: AppState = 'LOADING';
  busy = false;
  private listeners: Listener[] = [];

  can(to: AppState) {
    return !this.busy && TRANSITIONS[this.state].includes(to);
  }

  go(to: AppState, force = false): boolean {
    if (!force && !this.can(to)) return false;
    const from = this.state;
    this.state = to;
    document.documentElement.dataset.state = to.toLowerCase();
    this.listeners.forEach((l) => l(to, from));
    return true;
  }

  is(...states: AppState[]) {
    return states.includes(this.state);
  }

  on(fn: Listener) {
    this.listeners.push(fn);
  }
}
