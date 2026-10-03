import type * as React from 'react';

/** Hues a pocket can take. Each maps to pocket-<hue>, pocket-<hue>-tint and pocket-<hue>-ink. */
export type PocketHue = 'palm' | 'sky' | 'clay' | 'teal' | 'plum' | 'olive';
/** Names from the bundled Phosphor set (see the Icon card). */
export type IconName = string;

/* formatting helpers */
/** $1,240.50; sign 'in' gives +$12.50 and 'out' gives a true minus sign (U+2212). */
export declare function formatUSDC(n: number, opts?: { sign?: 'in' | 'out' }): string;
/** ₦18,750, rounded to whole naira with en-NG grouping. */
export declare function formatNaira(n: number): string;
/** 0x3f2a…9c1e: first six and last four characters. */
export declare function shortAddress(address: string): string;
/** Applies one Keypad key ('0' to '9', '.', 'back') to an amount string; keeps two decimals and nine characters. */
export declare function applyKey(value: string, key: string): string;

export interface IconProps { name: IconName; size?: number; filled?: boolean; label?: string; className?: string; style?: React.CSSProperties }
export declare function Icon(props: IconProps): React.ReactElement | null;

export interface LogoProps { variant?: 'wordmark' | 'mark'; className?: string; label?: string }
export declare function Logo(props: LogoProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'tonal' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  iconStart?: IconName;
  iconEnd?: IconName;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: becomes aria-label and title. */
  label: string;
  variant?: 'ghost' | 'secondary' | 'tonal';
  size?: 'sm' | 'md';
  filled?: boolean;
  /** Renders a link instead of a button. */
  href?: string;
}
export declare function IconButton(props: IconButtonProps): React.ReactElement;

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  mono?: boolean;
  multiline?: boolean;
}
export declare function TextField(props: TextFieldProps): React.ReactElement;

export interface AmountInputProps {
  label?: string;
  /** Amount as a string, for example "12.50". */
  value?: string;
  onChange?: (value: string) => void;
  /** Set true when a Keypad drives the value on compact screens. */
  readOnly?: boolean;
  /** Naira per USDC, display only. */
  rate?: number;
  available?: number;
  availableLabel?: string;
  error?: React.ReactNode;
  id?: string;
  autoFocus?: boolean;
}
export declare function AmountInput(props: AmountInputProps): React.ReactElement;

export interface KeypadProps { onKey?: (key: string) => void; label?: string }
export declare function Keypad(props: KeypadProps): React.ReactElement;

export interface SwitchProps { checked?: boolean; onChange?: (checked: boolean) => void; label: string; description?: React.ReactNode; disabled?: boolean; id?: string }
export declare function Switch(props: SwitchProps): React.ReactElement;

export interface SegmentedOption { value: string; label: React.ReactNode }
export interface SegmentedControlProps { options: Array<SegmentedOption | string>; value?: string; onChange?: (value: string) => void; label: string; block?: boolean }
export declare function SegmentedControl(props: SegmentedControlProps): React.ReactElement;

export interface BadgeProps { tone?: 'neutral' | 'brand' | 'positive' | 'caution' | 'negative' | 'accent'; icon?: IconName | false; children?: React.ReactNode }
export declare function Badge(props: BadgeProps): React.ReactElement;

export interface MoneyProps {
  /** USDC amount as a number. */
  value: number;
  rate?: number;
  size?: 'hero' | 'lg' | 'md' | 'sm';
  direction?: 'in' | 'out';
  naira?: boolean;
  /** Shows the USDC unit label; defaults to true for hero. */
  unit?: boolean;
  align?: 'start' | 'center' | 'end';
  className?: string;
}
export declare function Money(props: MoneyProps): React.ReactElement;

export interface AddressProps { value: string; label?: React.ReactNode; copy?: boolean; href?: string }
export declare function Address(props: AddressProps): React.ReactElement;

export interface PocketIconProps { icon?: IconName; hue?: PocketHue; size?: 'sm' | 'md' | 'lg' }
export declare function PocketIcon(props: PocketIconProps): React.ReactElement;

export interface AllowanceMeterProps { spent?: number; limit?: number; hue?: PocketHue; periodLabel?: string; resetLabel?: string }
export declare function AllowanceMeter(props: AllowanceMeterProps): React.ReactElement;

export interface PocketCardProps {
  label: string;
  icon?: IconName;
  hue?: PocketHue;
  balance?: number;
  rate?: number;
  /** 0 means every payment is a request. */
  limit?: number;
  spent?: number;
  periodLabel?: string;
  resetLabel?: string;
  /** Shown to the sender only, as "Locked until <value>". */
  lockedUntil?: string;
  pending?: number;
  payeeOnly?: boolean;
  view?: 'sender' | 'family';
  href?: string;
  onOpen?: () => void;
  onPay?: () => void;
  onAsk?: () => void;
  onAddMoney?: () => void;
}
export declare function PocketCard(props: PocketCardProps): React.ReactElement;

export interface RequestCardProps {
  amount: number;
  rate?: number;
  to?: string;
  memo?: string;
  pocketLabel: string;
  hue?: PocketHue;
  icon?: IconName;
  time?: string;
  state?: 'pending' | 'approving' | 'declining';
  onApprove?: () => void;
  onDecline?: () => void;
}
export declare function RequestCard(props: RequestCardProps): React.ReactElement;

export interface ActivityItemProps {
  kind?: 'spent' | 'funded' | 'requested' | 'approved' | 'declined' | 'withdrawn' | 'fee' | 'locked' | 'created';
  title: React.ReactNode;
  detail?: React.ReactNode;
  amount?: number;
  time?: string;
  status?: 'Pending' | 'Final' | 'Declined' | 'Failed';
  /** Explorer link for the receipt. */
  href?: string;
}
export declare function ActivityItem(props: ActivityItemProps): React.ReactElement;
export declare function ActivityList(props: { children?: React.ReactNode; label?: string }): React.ReactElement;

export interface TxStep { label: string; detail?: string; state?: 'todo' | 'active' | 'done' | 'error' }
export interface TxStatusProps { title?: string; steps: TxStep[]; href?: string; hrefLabel?: string }
export declare function TxStatus(props: TxStatusProps): React.ReactElement;

export interface NoticeProps { tone?: 'info' | 'positive' | 'caution' | 'negative' | 'lock'; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; icon?: IconName }
export declare function Notice(props: NoticeProps): React.ReactElement;

export interface ToastProps { tone?: 'neutral' | 'positive' | 'negative'; children?: React.ReactNode; action?: React.ReactNode; onClose?: () => void }
export declare function Toast(props: ToastProps): React.ReactElement;

export interface EmptyStateProps { icon?: IconName; title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;

export interface SkeletonProps { width?: number | string; height?: number | string; radius?: string; lines?: number; label?: string }
export declare function Skeleton(props: SkeletonProps): React.ReactElement;

export interface SheetProps {
  open?: boolean;
  onClose?: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Put the secondary action first and the primary last. */
  footer?: React.ReactNode;
  /** Renders in place without a modal, for documentation. */
  inline?: boolean;
}
export declare function Sheet(props: SheetProps): React.ReactElement;

export interface AppBarProps { title: React.ReactNode; subtitle?: React.ReactNode; back?: { label?: string; onClick?: () => void }; actions?: React.ReactNode }
export declare function AppBar(props: AppBarProps): React.ReactElement;

export interface NavItem { icon: IconName; label: string; href?: string; active?: boolean; badge?: number; onClick?: (e: React.MouseEvent) => void }
export declare function TabBar(props: { items: NavItem[]; label?: string }): React.ReactElement;
export declare function SideNav(props: { items: NavItem[]; footer?: React.ReactNode; label?: string }): React.ReactElement;
export declare function AppShell(props: { nav: NavItem[]; navFooter?: React.ReactNode; children?: React.ReactNode }): React.ReactElement;

declare global {
  interface Window {
    Earmark: {
      Icon: typeof Icon; Logo: typeof Logo; Button: typeof Button; IconButton: typeof IconButton;
      TextField: typeof TextField; AmountInput: typeof AmountInput; Keypad: typeof Keypad; Switch: typeof Switch;
      SegmentedControl: typeof SegmentedControl; Badge: typeof Badge; Money: typeof Money; Address: typeof Address;
      PocketIcon: typeof PocketIcon; AllowanceMeter: typeof AllowanceMeter; PocketCard: typeof PocketCard;
      RequestCard: typeof RequestCard; ActivityItem: typeof ActivityItem; ActivityList: typeof ActivityList;
      TxStatus: typeof TxStatus; Notice: typeof Notice; Toast: typeof Toast; EmptyState: typeof EmptyState;
      Skeleton: typeof Skeleton; Sheet: typeof Sheet; AppBar: typeof AppBar; TabBar: typeof TabBar;
      SideNav: typeof SideNav; AppShell: typeof AppShell;
      formatUSDC: typeof formatUSDC; formatNaira: typeof formatNaira; shortAddress: typeof shortAddress; applyKey: typeof applyKey;
    };
  }
}
