import { graphql } from "@/lib/graphql/generated";

export const GenerateMatchdaysMutation = graphql(/* GraphQL */ `
  mutation GenerateMatchdays($id: ID!) {
    generateMatchdays(id: $id) {
      id
      slug
    }
  }
`);
