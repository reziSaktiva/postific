/** Domain error classes for start-page. */
export class StartPageDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartPageDomainError";
  }
}

/** Slug tidak memenuhi format (huruf kecil/angka/hubung, panjang, dst.). */
export class InvalidSlugError extends StartPageDomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSlugError";
  }
}

/** Slug valid secara format tapi bentrok dengan path/route yang dicadangkan. */
export class ReservedSlugError extends StartPageDomainError {
  constructor(readonly slug: string) {
    super(`Slug "${slug}" is reserved and cannot be used`);
    this.name = "ReservedSlugError";
  }
}
