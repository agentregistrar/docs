/**
 * MDX globals registry - components available inside MDX without `import`.
 * Wired via `<Content components={components} />` in `[...slug].astro`.
 *
 * Content issues use these names only; local colors, fonts, radius/shadow
 * utilities and icons are not allowed in content (see THEME.md).
 */

import { Aside } from "./components/ui/aside";
import { Badge } from "./components/ui/badge";
import { Banner } from "./components/ui/banner";
import { Card } from "./components/ui/card";
import { CardGrid } from "./components/ui/card-grid";
import { Code } from "./components/ui/code";
import { CodeGroup } from "./components/ui/code-group";
import { FileTree } from "./components/ui/file-tree";
import { LinkCard } from "./components/ui/link-card";
import { PackageManagers } from "./components/ui/package-managers";
import { Step, Steps } from "./components/ui/steps";
import { TabItem, Tabs } from "./components/ui/tabs";
import PromptPersonalizer from "./components/PromptPersonalizer.astro";
import Render from "./components/Render.astro";
import ValidatorPersonalizer from "./components/ValidatorPersonalizer.astro";

export const components = {
  Aside,
  Badge,
  Banner,
  Card,
  CardGrid,
  Code,
  CodeGroup,
  FileTree,
  LinkCard,
  PackageManagers,
  PromptPersonalizer,
  Render,
  Step,
  Steps,
  TabItem,
  Tabs,
  ValidatorPersonalizer,
};
