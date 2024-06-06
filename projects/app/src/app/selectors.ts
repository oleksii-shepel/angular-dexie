import { selectorAsync } from '@actioncrew/actionstack';


export const selectTree = selectorAsync("@global", async (state: any, props: any) => await state.reader?.get(props));
