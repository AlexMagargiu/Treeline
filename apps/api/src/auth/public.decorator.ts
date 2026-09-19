import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'treeline:public';

/** Exempts a handler from the global session guard. Login, logout and health only. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
