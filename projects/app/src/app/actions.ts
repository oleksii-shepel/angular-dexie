
import { action } from '@actioncrew/actionstack';

export enum FormActions {
  InitTree = 'INIT_TREE',
  UpdateTree = 'UPDATE_TREE',
}

export const initTree = action(FormActions.InitTree, (tree: any) => ({tree}));
export const updateTree = action(FormActions.UpdateTree, (parent: any, subtree: any) => ({parent, subtree}));
