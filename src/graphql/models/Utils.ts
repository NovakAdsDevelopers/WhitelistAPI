
import { Field, ObjectType } from "type-graphql";
@ObjectType()
export class PaginationInfo {
  @Field()
  currentPage!:number

  @Field()
  totalPages!:number

  @Field()
  totalItems!:number

  @Field()
  hasNextPage!: boolean
  
  @Field()
  hasPreviousPage!: boolean
}
