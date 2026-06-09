"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Eye, EyeOff, MapPin, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { PageTitle } from "@/components/layout/page-title";
import {
  CreateCityMutation,
  CreateCountryMutation,
  LocationsAdminQuery,
  SetCityActiveMutation,
} from "@/lib/graphql/operations/location.operations";

export function LocationsAdmin() {
  const toast = useToast();
  const { data, refetch } = useQuery(LocationsAdminQuery, {
    fetchPolicy: "cache-and-network",
  });
  const [createCountry, { loading: cC }] = useMutation(CreateCountryMutation);
  const [createCity, { loading: cCi }] = useMutation(CreateCityMutation);
  const [setActive] = useMutation(SetCityActiveMutation);

  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [cityCountryId, setCityCountryId] = useState("");
  const [cityName, setCityName] = useState("");

  const countries = data?.countries ?? [];

  async function onAddCountry(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCountry({
        variables: { code: countryCode.toUpperCase(), name: countryName },
      });
      toast.success(`${countryName} added`);
      setCountryCode("");
      setCountryName("");
      await refetch();
    } catch (e) {
      toast.error("Could not add country", e);
    }
  }

  async function onAddCity(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCity({
        variables: { countryId: cityCountryId, name: cityName },
      });
      toast.success(`${cityName} added`);
      setCityName("");
      await refetch();
    } catch (e) {
      toast.error("Could not add city", e);
    }
  }

  async function onToggleActive(cityId: string, next: boolean) {
    try {
      await setActive({ variables: { id: cityId, isActive: next } });
      toast.success(next ? "City activated" : "City deactivated");
      await refetch();
    } catch (e) {
      toast.error("Could not update city", e);
    }
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Locations"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-3.5" /> Admin
          </span>
        }
        description="Add new countries and cities, or deactivate ones that are no longer in use. Deactivation is non-destructive — existing teams / competitions / venues keep their cityId."
      />
      <div className="p-4 md:p-8 max-w-5xl space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add country</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onAddCountry} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cc">ISO code</Label>
                  <Input
                    id="cc"
                    value={countryCode}
                    onChange={(e) =>
                      setCountryCode(e.target.value.toUpperCase().slice(0, 3))
                    }
                    placeholder="VN, US, GB…"
                    required
                    data-testid="country-code"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cn">Name</Label>
                  <Input
                    id="cn"
                    value={countryName}
                    onChange={(e) => setCountryName(e.target.value)}
                    placeholder="Vietnam"
                    required
                    data-testid="country-name"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={cC}
                    disabled={!countryCode || !countryName}
                    data-testid="country-submit"
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add city</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onAddCity} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select
                    value={cityCountryId}
                    onValueChange={setCityCountryId}
                    options={[
                      { value: "", label: "Pick a country…" },
                      ...countries.map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.code})`,
                      })),
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cityname">City name</Label>
                  <Input
                    id="cityname"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    placeholder="Da Nang"
                    required
                    data-testid="city-name"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={cCi}
                    disabled={!cityCountryId || !cityName}
                    data-testid="city-submit"
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Current locations
          </h2>
          {countries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No countries yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {countries.map((c) => (
                <Card key={c.id} data-testid={`country-card-${c.code}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {c.name}{" "}
                      <Badge variant="neutral" size="sm">
                        {c.code}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {c.cities.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No cities yet.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {c.cities.map((ci) => (
                          <li
                            key={ci.id}
                            className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-sm ${
                              ci.isActive ? "" : "opacity-50"
                            }`}
                            data-testid={`city-row-${ci.id}`}
                          >
                            <MapPin className="size-3 text-muted-foreground" />
                            <span className="flex-1">{ci.name}</span>
                            {!ci.isActive ? (
                              <Badge variant="neutral" size="sm">
                                Inactive
                              </Badge>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onToggleActive(ci.id, !ci.isActive)}
                              title={ci.isActive ? "Deactivate" : "Activate"}
                              data-testid={`city-toggle-${ci.id}`}
                            >
                              {ci.isActive ? (
                                <EyeOff className="size-3.5" />
                              ) : (
                                <Eye className="size-3.5" />
                              )}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
