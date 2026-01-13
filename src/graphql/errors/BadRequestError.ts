import { ValidationError } from "class-validator";

export class BadRequestError extends Error {
  public errors: any[];
  public statusCode: number;

  constructor(message: string, errors: any[] = []) {
    super(message);
    this.name = "BadRequestError";
    this.statusCode = 400;
    
    // Aqui aplicamos a mágica: limpamos o objeto gigante do class-validator
    this.errors = this.formatErrors(errors);
    
    // Boa prática para classes estendidas em TS
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }

  // Método auxiliar para deixar o erro limpo para o Front-end
  private formatErrors(errors: any[]): any[] {
    if (!errors || errors.length === 0) return [];

    // Se o primeiro item for do tipo ValidationError (do class-validator)
    if (errors[0] instanceof ValidationError) {
      return errors.map((err: ValidationError) => ({
        field: err.property,
        // Pega as mensagens de erro (constraints) e transforma em array
        messages: err.constraints ? Object.values(err.constraints) : ["Erro de validação"]
      }));
    }

    // Se forem outros tipos de erro (ex: strings manuais), retorna como está
    return errors;
  }
}