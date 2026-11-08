import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InvestorController } from './investor.controller';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

@Module({
  imports: [JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET') }) })],
  controllers: [InvestorController],
  providers: [JwtAuthGuard],
})
export class InvestorModule {}
