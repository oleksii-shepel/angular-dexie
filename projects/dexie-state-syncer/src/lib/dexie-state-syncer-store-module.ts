import { ModuleWithProviders, NgModule } from "@angular/core";
import { FeatureModule, MainModule, initializeStore, loadModule } from "./dexie-state-syncer-redux";

@NgModule({})
export class StoreModule {
  static store: any;

  static forRoot(module: MainModule): ModuleWithProviders<StoreModule> {
    const store = initializeStore(module);
    return {
      ngModule: StoreModule,
      providers: [
        { provide: 'Store', useValue: store }
      ]
    };
  }

  static forFeature(module: FeatureModule): ModuleWithProviders<StoreModule> {
    loadModule(StoreModule.store, module);
    return {
      ngModule: StoreModule,
      providers: [
        // Other providers...
      ]
    };
  }
}
