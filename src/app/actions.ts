
import { createAction, props } from '@ngrx/store';

export enum FormActions {
  UpdateForm = '@forms/form/update',
  UpdateControl = '@forms/form/control/update',
}

export enum FormActionsInternal {
  AutoInit = '@forms/form/init',
  AutoSubmit = '@forms/form/submit',
  FormDestroyed = '@forms/form/destroyed',
}

export const initTree = createAction(FormActionsInternal.AutoInit, props<{ init: boolean }>());
export const updateTree = createAction(FormActions.UpdateForm, props<{ init: boolean }>());
