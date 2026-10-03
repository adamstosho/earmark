// Typed facade over the copied design-system source. `index.tsx` is untyped (it keeps its own `any`, as the
// implementation guide allows), so app code imports from here and gets the props declared in the design system's
// own `components/index.d.ts` (copied unchanged as `earmark.d.ts`).
import * as Impl from './index';
import type * as T from './earmark';

export type { PocketHue, IconName, NavItem, TxStep, ButtonProps, MoneyProps, PocketCardProps } from './earmark';

export const formatUSDC = Impl.formatUSDC;
export const formatNaira = Impl.formatNaira;
export const shortAddress = Impl.shortAddress;
export const applyKey = Impl.applyKey;

export const Icon = Impl.Icon as typeof T.Icon;
export const Logo = Impl.Logo as typeof T.Logo;
export const Button = Impl.Button as typeof T.Button;
export const IconButton = Impl.IconButton as typeof T.IconButton;
export const TextField = Impl.TextField as typeof T.TextField;
export const AmountInput = Impl.AmountInput as typeof T.AmountInput;
export const Keypad = Impl.Keypad as typeof T.Keypad;
export const Switch = Impl.Switch as typeof T.Switch;
export const SegmentedControl = Impl.SegmentedControl as typeof T.SegmentedControl;
export const Badge = Impl.Badge as typeof T.Badge;
export const Money = Impl.Money as typeof T.Money;
export const Address = Impl.Address as typeof T.Address;
export const PocketIcon = Impl.PocketIcon as typeof T.PocketIcon;
export const AllowanceMeter = Impl.AllowanceMeter as typeof T.AllowanceMeter;
export const PocketCard = Impl.PocketCard as typeof T.PocketCard;
export const RequestCard = Impl.RequestCard as typeof T.RequestCard;
export const ActivityItem = Impl.ActivityItem as typeof T.ActivityItem;
export const ActivityList = Impl.ActivityList as typeof T.ActivityList;
export const TxStatus = Impl.TxStatus as typeof T.TxStatus;
export const Notice = Impl.Notice as typeof T.Notice;
export const Toast = Impl.Toast as typeof T.Toast;
export const EmptyState = Impl.EmptyState as typeof T.EmptyState;
export const Skeleton = Impl.Skeleton as typeof T.Skeleton;
export const Sheet = Impl.Sheet as typeof T.Sheet;
export const AppBar = Impl.AppBar as typeof T.AppBar;
export const TabBar = Impl.TabBar as typeof T.TabBar;
export const SideNav = Impl.SideNav as typeof T.SideNav;
export const AppShell = Impl.AppShell as typeof T.AppShell;
