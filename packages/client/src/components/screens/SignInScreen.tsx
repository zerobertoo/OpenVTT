import { passwordSchema, type UserDto, usernameSchema } from "@openvtt/shared";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { queryKeys, useSessionExpired } from "../../queries";
import { ErrorMessage } from "../../ui";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

/** Sign in or create an account. Creating one checks the same rules the server enforces; signing in only needs something typed. */
export function SignInScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<unknown>(null);
  const registering = mode === "register";
  const sessionExpired = useSessionExpired();

  const form = useForm({
    defaultValues: { username: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const user: UserDto = await (registering ? api.register : api.login)(value.username, value.password);
        queryClient.setQueryData(queryKeys.sessionExpired, false);
        queryClient.setQueryData(queryKeys.me, user);
      } catch (err) {
        setError(err);
      }
    },
  });

  const validateUsername = ({ value }: { value: string }) => {
    if (!value.trim()) return t("validation.required");
    return registering && !usernameSchema.safeParse(value).success ? t("validation.usernameInvalid") : undefined;
  };
  const validatePassword = ({ value }: { value: string }) => {
    if (!value) return t("validation.required");
    return registering && !passwordSchema.safeParse(value).success ? t("validation.passwordTooShort") : undefined;
  };

  const switchMode = () => {
    setMode(registering ? "login" : "register");
    setError(null);
    form.reset();
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <h1 className="m-0 max-w-[16ch] text-balance font-extrabold text-[2.2rem] leading-[1.15] tracking-tight max-[52rem]:text-[1.8rem]">
          {t("auth.welcomeTitle")}
        </h1>
        <p className="m-0 max-w-[34ch] text-[1.05rem] text-ink-2">{t("auth.welcomeText")}</p>
        {sessionExpired && (
          <p role="status" className="m-0 max-w-[34ch] font-semibold text-accent-text">
            {t("auth.sessionEnded")}
          </p>
        )}
      </div>
      <Card as="section" aria-label={t(registering ? "auth.register" : "auth.login")} className="grid gap-4">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="username" validators={{ onBlur: validateUsername, onSubmit: validateUsername }}>
            {(field) => (
              <Field label={t("auth.username")} error={field.state.meta.errors[0]}>
                {(control) => (
                  <Input
                    {...control}
                    name={field.name}
                    autoComplete="username"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </Field>
            )}
          </form.Field>
          <form.Field name="password" validators={{ onBlur: validatePassword, onSubmit: validatePassword }}>
            {(field) => (
              <Field
                label={t("auth.password")}
                error={field.state.meta.errors[0]}
                hint={registering ? t("validation.passwordHint") : undefined}
              >
                {(control) => (
                  <Input
                    {...control}
                    name={field.name}
                    type="password"
                    autoComplete={registering ? "new-password" : "current-password"}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </Field>
            )}
          </form.Field>
          <ErrorMessage error={error} />
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" pending={isSubmitting}>
                {t(registering ? "auth.register" : "auth.login")}
              </Button>
            )}
          </form.Subscribe>
        </form>
        {registering && <p className="m-0 text-ink-2 text-sm">{t("auth.firstUserHint")}</p>}
        <Button type="button" variant="link" className="justify-self-start" onClick={switchMode}>
          {t(registering ? "auth.switchToLogin" : "auth.switchToRegister")}
        </Button>
      </Card>
    </div>
  );
}
