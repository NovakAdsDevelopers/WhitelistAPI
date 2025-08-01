import { registerEnumType } from 'type-graphql';

export enum TipoTransacaoConta {
  ENTRADA = 'ENTRADA',
  SAIDA = 'SAIDA',
  REALOCACAO = 'REALOCACAO'
}

registerEnumType(TipoTransacaoConta, {
  name: 'TipoTransacaoConta'
});
