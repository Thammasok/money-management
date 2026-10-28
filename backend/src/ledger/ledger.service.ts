import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IExchangeRatesService } from '../rates/interfaces/exchange-rates-service.interface';
import { RATES_SERVICE } from '../rates/rates.tokens';
import type { CreateWalletDto } from './dto/create-wallet.dto';
import type {
  TransactionResponseDto,
  WalletDetailResponseDto,
  WalletListResponseDto,
  WalletResponseDto,
} from './dto/ledger-response.dto';
import type { RecordTransactionDto } from './dto/record-transaction.dto';
import type { ILedgerRepository } from './interfaces/ledger-repository.interface';
import type { ILedgerService } from './interfaces/ledger-service.interface';
import {
  toTransactionResponse,
  toWalletDetailResponse,
  toWalletResponse,
  toWalletSummaryResponse,
} from './ledger-response.mapper';
import { LedgerMessage } from './ledger.messages';
import { LEDGER_REPOSITORY } from './ledger.tokens';
import { isUuid } from './uuid';

@Injectable()
export class LedgerService implements ILedgerService {
  constructor(
    @Inject(LEDGER_REPOSITORY) private readonly repository: ILedgerRepository,
    @Inject(RATES_SERVICE) private readonly rates: IExchangeRatesService,
  ) {}

  async createWallet(userId: string, input: CreateWalletDto): Promise<WalletResponseDto> {
    // Asked of Exchange Rates, after the request's shape passed validation (a Currency 400 reads like a DTO 400).
    if (!this.rates.isSupportedCurrency(input.currency)) {
      throw new BadRequestException({
        statusCode: 400,
        message: [LedgerMessage.currency],
        error: 'Bad Request',
      });
    }

    const wallet = await this.repository.insertWallet({
      userId,
      name: input.name,
      currency: input.currency,
      // The money rule: what is stored and shown is the canonical integer ("000150" → 150, "-0" → 0).
      openingBalanceMinor: BigInt(input.openingBalanceMinor),
    });
    // A Wallet with no Transactions yet: its Balance is its Opening Balance.
    return toWalletResponse(wallet, wallet.openingBalanceMinor);
  }

  async listWallets(userId: string): Promise<WalletListResponseDto> {
    const wallets = await this.repository.listWalletsOwnedBy(userId);
    return { wallets: wallets.map(toWalletSummaryResponse) };
  }

  async getWallet(userId: string, walletId: string): Promise<WalletDetailResponseDto> {
    if (!isUuid(walletId)) {
      throw walletNotFound();
    }
    const detail = await this.repository.findOwnedWalletDetail(userId, walletId);
    if (detail === null) {
      throw walletNotFound();
    }
    return toWalletDetailResponse(detail);
  }

  async recordTransaction(
    userId: string,
    walletId: string,
    input: RecordTransactionDto,
  ): Promise<TransactionResponseDto> {
    // The request's shape (including "not after today") was validated before this point — a 400 never reveals
    // whether a Wallet exists — so the Wallet is looked up only now.
    if (!isUuid(walletId)) {
      throw walletNotFound();
    }
    const wallet = await this.repository.findOwnedWallet(userId, walletId);
    if (wallet === null) {
      throw walletNotFound();
    }
    // (F-3 inserts the "archived Wallet → 409" check here, after the 404.)

    const transaction = await this.repository.insertTransaction({
      walletId: wallet.id,
      kind: input.kind,
      amountMinor: BigInt(input.amountMinor),
      occurredOn: input.occurredOn,
      note: input.note ?? null,
    });
    return toTransactionResponse(transaction);
  }
}

/** One answer for a missing Wallet, another User's Wallet and a malformed id, so nothing reveals that a Wallet exists. */
function walletNotFound(): NotFoundException {
  return new NotFoundException(LedgerMessage.walletNotFound);
}
