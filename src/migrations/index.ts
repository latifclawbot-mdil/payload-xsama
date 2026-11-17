import * as migration_20261112_080055 from './20261112_080055';
import * as migration_20261112_121525_add_build_hook_url from './20261112_121525_add_build_hook_url';
import * as migration_20261112_103000_content_contract from './20261112_103000_content_contract';

export const migrations = [
  {
    up: migration_20261112_080055.up,
    down: migration_20261112_080055.down,
    name: '20261112_080055',
  },
  {
    up: migration_20261112_121525_add_build_hook_url.up,
    down: migration_20261112_121525_add_build_hook_url.down,
    name: '20261112_121525_add_build_hook_url'
  },
  {
    up: migration_20261112_103000_content_contract.up,
    down: migration_20261112_103000_content_contract.down,
    name: '20261112_103000_content_contract'
  },
];
