import { InputType, Field, Int } from 'type-graphql';

@InputType()
export class Pagination {
  @Field(() => Int, { nullable: true })
  pagina?: number;

  @Field(() => Int, { nullable: true })
  quantidade?: number;
}
