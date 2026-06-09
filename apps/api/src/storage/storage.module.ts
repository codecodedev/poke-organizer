import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService, LocalStorageService, SupabaseStorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('STORAGE_PROVIDER') || 'local';
        if (provider === 'supabase') {
          return new SupabaseStorageService(config);
        }
        return new LocalStorageService(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
