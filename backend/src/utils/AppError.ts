export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }

  static notFound(entity: string) {
    return new AppError(`${entity} nao encontrado(a).`, 404);
  }

  static conflict(message: string) {
    return new AppError(message, 409);
  }

  static forbidden(message = "Voce nao tem permissao para executar esta acao.") {
    return new AppError(message, 403);
  }

  static unauthorized(message = "Nao autenticado.") {
    return new AppError(message, 401);
  }
}
