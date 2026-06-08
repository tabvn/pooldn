import { graphql } from "@/lib/graphql/generated";

export const LoginMutation = graphql(/* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        username
        name
        role
      }
    }
  }
`);

export const RegisterMutation = graphql(/* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
        name
        role
      }
    }
  }
`);

export const LogoutMutation = graphql(/* GraphQL */ `
  mutation Logout {
    logout
  }
`);
