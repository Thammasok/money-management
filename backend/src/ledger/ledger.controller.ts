import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../identity/identity.decorators';
import type { SignedInUser } from '../identity/interfaces/identity-service.interface';
import { CreateWalletDto } from './dto/create-wallet.dto';
import type {
  TransactionResponseDto,
  WalletDetailResponseDto,
  WalletOverviewResponseDto,
  WalletResponseDto,
} from './dto/ledger-response.dto';
import { RecordTransactionDto } from './dto/record-transaction.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import type { ILedgerService } from './interfaces/ledger-service.interface';
import { LEDGER_SERVICE } from './ledger.tokens';

/**
 * Controller for Wallets and their Transactions under `/api/v1/wallets`: parses the request, calls the service for the
 * signed-in User (the global SessionGuard has already answered 401 otherwise). The Wallet id is deliberately a plain
 * string — a malformed one is a 404 from the service, never a 400 from a pipe.
 */
@Controller('wallets')
export class LedgerController {
  constructor(@Inject(LEDGER_SERVICE) private readonly ledger: ILedgerService) {}

  /** Create a Wallet (a 201). */
  @Post()
  createWallet(
    @CurrentUser() current: SignedInUser,
    @Body() body: CreateWalletDto,
  ): Promise<WalletResponseDto> {
    return this.ledger.createWallet(current.userId, body);
  }

  /** The Wallet Overview: the User's Wallets with their Balances, newest first, and the Currency Totals. */
  @Get()
  listWallets(@CurrentUser() current: SignedInUser): Promise<WalletOverviewResponseDto> {
    return this.ledger.listWallets(current.userId);
  }

  /** One Wallet with its Balance and its Transactions, newest first. */
  @Get(':walletId')
  getWallet(
    @CurrentUser() current: SignedInUser,
    @Param('walletId') walletId: string,
  ): Promise<WalletDetailResponseDto> {
    return this.ledger.getWallet(current.userId, walletId);
  }

  /** Rename the Wallet and/or archive it (a 200 with the Wallet). The Currency never changes; there is no unarchive. */
  @Patch(':walletId')
  updateWallet(
    @CurrentUser() current: SignedInUser,
    @Param('walletId') walletId: string,
    @Body() body: UpdateWalletDto,
  ): Promise<WalletResponseDto> {
    return this.ledger.updateWallet(current.userId, walletId, body);
  }

  /** Record an Income or an Expense in the Wallet (a 201). */
  @Post(':walletId/transactions')
  recordTransaction(
    @CurrentUser() current: SignedInUser,
    @Param('walletId') walletId: string,
    @Body() body: RecordTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.ledger.recordTransaction(current.userId, walletId, body);
  }
}
