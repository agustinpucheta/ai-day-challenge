import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env, tokenKeyringFromEnv } from '../config/env';
import { TokenCipher } from './token-cipher';

@Module({
  providers: [
    {
      provide: TokenCipher,
      inject: [ConfigService],
      // Without a key the cipher exists but fails on use, so the API still boots without OAuth.
      useFactory: (config: ConfigService<Env, true>) =>
        new TokenCipher(
          tokenKeyringFromEnv({
            TOKEN_ENCRYPTION_KEY: config.get('TOKEN_ENCRYPTION_KEY', { infer: true }),
            TOKEN_ENCRYPTION_KEY_VERSION: config.get('TOKEN_ENCRYPTION_KEY_VERSION', {
              infer: true,
            }),
            TOKEN_ENCRYPTION_PREVIOUS_KEYS: config.get('TOKEN_ENCRYPTION_PREVIOUS_KEYS', {
              infer: true,
            }),
          }),
        ),
    },
  ],
  exports: [TokenCipher],
})
export class CryptoModule {}
