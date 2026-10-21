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
import { Tabs, TabItem } from "./components/ui/tabs";
import Render from "./components/Render.astro";

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
  Render,
  Step,
  Steps,
  TabItem,
  Tabs,
};
