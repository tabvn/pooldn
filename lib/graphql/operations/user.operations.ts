import { graphql } from "@/lib/graphql/generated";

export const UsersQuery = graphql(/* GraphQL */ `
  query Users {
    users {
      id
      name
      username
      email
      createdAt
    }
  }
`);

export const UserByIdQuery = graphql(/* GraphQL */ `
  query UserById($id: ID!) {
    user(id: $id) {
      id
      name
      username
      email
      createdAt
    }
  }
`);

export const CreateUserMutation = graphql(/* GraphQL */ `
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
      username
      email
    }
  }
`);
