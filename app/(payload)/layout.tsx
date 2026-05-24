import config from "@payload-config";
import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import { getPayload } from "payload";
import type { ServerFunctionClient } from "payload";
import type { ReactNode } from "react";

import "@payloadcms/next/css";
import "./custom.scss";

import { ensurePayloadSchema } from "@/lib/payload-ensure-schema";

import { importMap } from "./admin/importMap.js";

type Args = {
  children: ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  });
};

const Layout = async ({ children }: Args) => {
  if (process.env.PAYLOAD_SECRET?.trim() && process.env.POSTGRES_URL) {
    const payload = await getPayload({ config, importMap });
    await ensurePayloadSchema(payload);
  }

  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
};

export default Layout;
