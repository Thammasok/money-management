import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IExchangeRatesService } from '../rates/interfaces/exchange-rates-service.interface';
import { RATES_SERVICE } from '../rates/rates.tokens';
import { currencyTotalsOf } from './currency-total';
import type { CreateWalletDto } from './dto/create-wallet.dto';
import type {
  TransactionResponseDto,
  WalletDetailResponseDto,
  WalletOverviewResponseDto,
  WalletResponseDto,
} from './dto/ledger-response.dto';
import type { RecordTransactionDto } from './dto/record-transaction.dto';
import type { UpdateWalletDto } from './dto/update-wallet.dto';
import type { ILedgerRepository } from './interfaces/ledger-repository.interface';
import type { ILedgerService } from './interfaces/ledger-service.interface';
import {
  toCurrencyTotalResponse,
  toTransactionResponse,
  toWalletDetailResponse,
  toWalletOverviewItemResponse,
  toWalletResponse,
} from './ledger-response.mapper';
import { LedgerMessage } from './ledger.messages';
import { LEDGER_REPOSITORY } from './ledger.tokens';
import { isUuid } from './uuid';
import type { WalletChange } from './wallet.entity';

@Injectable()
export class LedgerService implements ILedgerService {
  constructor(
    @Inject(LEDGER_REPOSITORY) private readonly repository: ILedgerRepository,
    @Inject(RATES_SERVICE) private readonly rates: IExchangeRatesService,
  ) {}

  async createWallet(userId: string, input: CreateWalletDto): Promise<WalletResponseDto> {
    // Asked of Exchange Rates, after the request's shape passed validation (a Currency 400 reads like a DTO 400).
    if (!this.rates.isSupportedCurrency(input.currency)) {
      throw badRequest(LedgerMessage.currency);
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

  async listWallets(userId: string): Promise<WalletOverviewResponseDto> {
    const wallets = await this.repository.listWalletsOwnedBy(userId);
    return {
      wallets: wallets.map(toWalletOverviewItemResponse),
      currencyTotals: currencyTotalsOf(wallets).map(toCurrencyTotalResponse),
    };
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

  async updateWallet(
    userId: string,
    walletId: string,
    input: UpdateWalletDto,
  ): Promise<WalletResponseDto> {
    const change: WalletChange = { name: input.name ?? null, archive: input.archived === true };
    if (change.name === null && !change.archive) {
      // Part of the request's shape, so it is judged before the Wallet is looked up (a 400 never reveals a Wallet).
      throw badRequest(LedgerMessage.nothingToChange);
    }
    if (!isUuid(walletId)) {
      throw walletNotFound();
    }

    const updated = await this.repository.updateOwnedWallet(userId, walletId, change);
    if (updated !== null) {
      return toWalletResponse(updated.wallet, updated.balanceMinor);
    }
    // Nothing was applied. Either the Wallet is not the User's (404 — decided before any rule that needs the Wallet's
    // data, so nothing reveals that it exists), or it is, and the archive was asked for on a Wallet that is already
    // Archived: the one thing a visible Wallet refuses, and it refuses the whole change, a name sent along included.
    const wallet = await this.repository.findOwnedWallet(userId, walletId);
    if (wallet === null) {
      throw walletNotFound();
    }
    throw new ConflictException(LedgerMessage.alreadyArchived);
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

    const transaction = await this.repository.insertTransaction({
      walletId: wallet.id,
      kind: input.kind,
      amountMinor: BigInt(input.amountMinor),
      occurredOn: input.occurredOn,
      note: input.note ?? null,
    });
    if (transaction === null) {
      // An Archived Wallet accepts no new Transaction (409, after the 404 above). The archived check is part of the
      // insert itself, so an archive that commits after the lookup cannot slip a Transaction in behind it.
      throw new ConflictException(LedgerMessage.walletArchived);
    }
    return toTransactionResponse(transaction);
  }
}

/** One answer for a missing Wallet, another User's Wallet and a malformed id, so nothing reveals that a Wallet exists. */
function walletNotFound(): NotFoundException {
  return new NotFoundException(LedgerMessage.walletNotFound);
}

/** A 400 the service raises itself, shaped like a DTO failure (`message` is a one-line list) so a client shows both alike. */
function badRequest(message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message: [message], error: 'Bad Request' });
}
