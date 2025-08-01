import { InputType, Field } from "type-graphql";

@InputType()
export class GastoTotalInput {
  @Field()
  account_id!: string;

  @Field()
  startDate!: string;

  @Field({ nullable: true })
  endDate?: string;
}
