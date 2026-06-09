import { graphql } from "@/lib/graphql/generated";

export const LocationsAdminQuery = graphql(/* GraphQL */ `
  query LocationsAdmin {
    countries {
      id
      code
      name
      cities(includeInactive: true) {
        id
        name
        isActive
      }
    }
  }
`);

export const CreateCountryMutation = graphql(/* GraphQL */ `
  mutation CreateCountry($code: String!, $name: String!) {
    createCountry(code: $code, name: $name) {
      id
      code
      name
    }
  }
`);

export const CreateCityMutation = graphql(/* GraphQL */ `
  mutation CreateCity($countryId: ID!, $name: String!) {
    createCity(countryId: $countryId, name: $name) {
      id
      name
    }
  }
`);

export const RenameCityMutation = graphql(/* GraphQL */ `
  mutation RenameCity($id: ID!, $name: String!) {
    renameCity(id: $id, name: $name) {
      id
      name
    }
  }
`);

export const SetCityActiveMutation = graphql(/* GraphQL */ `
  mutation SetCityActive($id: ID!, $isActive: Boolean!) {
    setCityActive(id: $id, isActive: $isActive) {
      id
      isActive
    }
  }
`);
