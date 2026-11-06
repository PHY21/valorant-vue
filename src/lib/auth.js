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

export function validateRegistration({
  email = "",
  password = "",
  confirm = "",
  name = "",
}) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "请输入有效的邮箱地址。";
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
    invalid_credentials: "邮箱或密码不正确，请重新输入。",
    email_not_confirmed: "请先打开注册邮件，完成邮箱验证后再登录。",
    user_already_exists: "此邮箱可能已经注册，请尝试登录。",
    email_exists: "此邮箱可能已经注册，请尝试登录。",
    weak_password: "密码强度不足，请增加长度并混合使用字母、数字和符号。",
    signup_disabled: "暂时未开放注册，请稍后再试。",
    email_address_not_authorized:
      "验证邮件暂时无法发送，站点管理员需要配置邮件服务。",
    over_email_send_rate_limit: "邮件发送过于频繁，请稍后再试。",
    over_request_rate_limit: "操作过于频繁，请稍后再试。",
    otp_expired: "验证链接已过期或已使用，请重新发送验证邮件。",
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
    async register(fields, redirectTo) {
      const invalid = validateRegistration(fields);
      if (invalid) throw new Error(invalid);
      return result(
        requireClient().signUp({
          email: fields.email.trim(),
          password: fields.password,
          options: {
            data: { display_name: fields.name.trim() },
            emailRedirectTo: redirectTo,
          },
        }),
      );
    },
    async login(email, password) {
      return result(
        requireClient().signInWithPassword({ email: email.trim(), password }),
      );
    },
    async logout() {
      return result(requireClient().signOut({ scope: "local" }));
    },
    async resend(email, redirectTo) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error("请先在邮箱栏填写注册时使用的邮箱地址。");
      return result(
        requireClient().resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo: redirectTo },
        }),
      );
    },
  };
}
