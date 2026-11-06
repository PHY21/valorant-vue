export function safeReturnPath(value) {
  if (typeof value !== "string" || /[\\\u0000-\u001f]/.test(value))
    return "/account";
  const [path] = value.split("?");
  return /^(\/|\/account|\/favorites|\/compare|\/rankings|\/about|\/explore\/(player|team|tournament|agent)|\/detail\/(player|team|tournament|agent)\/[1-9]\d*)$/.test(
    path,
  )
    ? value
    : "/account";
}

export function usernameIdentity(value = "") {
  const username = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(username))
    throw new Error("用户名需 3–24 位，字母开头，仅含字母、数字和下划线。");
  return `atlas.${username}@accounts.invalid`;
}

export function validateRegistration({
  username = "",
  password = "",
  confirm = "",
  name = "",
}) {
  try {
    usernameIdentity(username);
  } catch (error) {
    return error.message;
  }
  if (!name.trim() || name.trim().length > 24) return "昵称需要 1–24 个字符。";
  if (password.length < 8 || password.length > 128)
    return "密码需要 8–128 个字符。";
  if (password !== confirm) return "两次输入的密码不一致。";
  return "";
}

export function publicAuthConfig(url, key) {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
    )
      return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}

export function authMessage(error) {
  const messages = {
    invalid_credentials: "用户名或密码不正确，请重新输入。",
    email_not_confirmed: "账号服务配置尚未完成，请稍后再试。",
    user_already_exists: "用户名已被使用，请换一个用户名或直接登录。",
    email_exists: "用户名已被使用，请换一个用户名或直接登录。",
    weak_password: "密码强度不足，请增加长度并混合使用字母、数字和符号。",
    signup_disabled: "暂时未开放注册，请稍后再试。",
    over_request_rate_limit: "操作过于频繁，请稍后再试。",
    over_email_send_rate_limit: "账号服务配置尚未完成，请稍后再试。",
  };
  return messages[error?.code] || "暂时无法连接账号服务，请检查网络后重试。";
}

export function createAccountService(client) {
  function requireClient() {
    if (!client) throw new Error("账号服务尚未配置，暂时无法登录或注册。");
    return client.auth;
  }
  async function result(promise) {
    try {
      const { data, error } = await promise;
      if (error) throw new Error(authMessage(error));
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("。")) throw error;
      throw new Error(authMessage(error));
    }
  }
  return {
    async register(fields) {
      const invalid = validateRegistration(fields);
      if (invalid) throw new Error(invalid);
      const data = await result(
        requireClient().signUp({
          email: usernameIdentity(fields.username),
          password: fields.password,
          options: {
            data: {
              display_name: fields.name.trim(),
              username: fields.username.trim().toLowerCase(),
            },
          },
        }),
      );
      if (!data?.session)
        throw new Error("账号服务配置尚未完成，暂时无法注册，请稍后再试。");
      return data;
    },
    async login(username, password) {
      return result(
        requireClient().signInWithPassword({
          email: usernameIdentity(username),
          password,
        }),
      );
    },
    async logout() {
      return result(requireClient().signOut({ scope: "local" }));
    },
  };
}
