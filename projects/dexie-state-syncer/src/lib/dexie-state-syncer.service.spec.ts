import { TestBed } from '@angular/core/testing';

import { DexieStateSyncerService } from './dexie-state-syncer.service';

describe('DexieStateSyncerService', () => {
  let service: DexieStateSyncerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DexieStateSyncerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
