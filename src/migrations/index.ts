import * as migration_20261112_080055 from './20261112_080055';
import * as migration_20261112_121525_add_build_hook_url from './20261112_121525_add_build_hook_url';
import * as migration_20261112_103000_content_contract from './20261112_103000_content_contract';
import * as migration_20261117_130000_add_id_kn_locales from './20261117_130000_add_id_kn_locales';
import * as migration_20261117_140000_publishing_config from './20261117_140000_publishing_config';
import * as migration_20261118_080000_version_contract_fields from './20261118_080000_version_contract_fields';

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
  {
    up: migration_20261117_130000_add_id_kn_locales.up,
    down: migration_20261117_130000_add_id_kn_locales.down,
    name: '20261117_130000_add_id_kn_locales'
  },
  {
    up: migration_20261117_140000_publishing_config.up,
    down: migration_20261117_140000_publishing_config.down,
    name: '20261117_140000_publishing_config'
  },
  {
    up: migration_20261118_080000_version_contract_fields.up,
    down: migration_20261118_080000_version_contract_fields.down,
    name: '20261118_080000_version_contract_fields'
  },
];
