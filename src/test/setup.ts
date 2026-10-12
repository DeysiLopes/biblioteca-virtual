import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock BroadcastChannel se não existir no ambiente
if (typeof window !== 'undefined' && !window.BroadcastChannel) {
  class MockBroadcastChannel {
    name: string;
    onmessage: any = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage() {}
    close() {}
  }
  (window as any).BroadcastChannel = MockBroadcastChannel;
}
