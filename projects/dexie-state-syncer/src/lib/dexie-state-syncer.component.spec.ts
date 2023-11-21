import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DexieStateSyncerComponent } from './dexie-state-syncer.component';

describe('DexieStateSyncerComponent', () => {
  let component: DexieStateSyncerComponent;
  let fixture: ComponentFixture<DexieStateSyncerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DexieStateSyncerComponent]
    });
    fixture = TestBed.createComponent(DexieStateSyncerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
