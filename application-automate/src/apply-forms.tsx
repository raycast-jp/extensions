import { ActionPanel, Action, Icon, List, showToast, Toast, open } from "@raycast/api";

interface FormData {
  id: number;
  companyName: string;
  name: string;
  email: string;
  address: string;
  phone?: string;
  comment?: string;
}

const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdZ05WVF7M0316CS5tPsDQZRC1YEEuWggMAq3jDj6RqvS9wEw/viewform";

const ITEMS: FormData[] = [
  {
    id: 1,
    companyName: "株式会社サンプル1",
    name: "山田太郎",
    email: "yamada@example.com",
    address: "東京都渋谷区渋谷1-1-1",
    phone: "03-1234-5678",
    comment: "サンプルのお問い合わせです。",
  },
  {
    id: 2,
    companyName: "株式会社サンプル2",
    name: "鈴木一郎",
    email: "suzuki@example.com",
    address: "大阪府大阪市中央区1-1-1",
    phone: "06-1234-5678",
  },
];

async function applyForm(item: FormData) {
  const formParams = {
    "entry.2005620554": item.companyName,   // 会社名
    "entry.185333929": item.name,           // 名前
    "entry.1045781291": item.email,         // メールアドレス
    "entry.1065046570": item.address,       // 住所
    "entry.1166974658": item.phone || "",   // 電話番号
    "entry.839337160": item.comment || "",  // コメント
  };

  const params = new URLSearchParams(formParams);
  const url = `${FORM_URL}?${params.toString()}`;
  await open(url);
  await showToast({
    style: Toast.Style.Success,
    title: "フォームを開きました",
    message: "自動入力用のURLを開きました",
  });
}

export default function Command() {
  return (
    <List>
      {ITEMS.map((item) => (
        <List.Item
          key={item.id}
          icon={Icon.Document}
          title={item.companyName}
          subtitle={item.name}
          accessories={[{ text: item.email }]}
          actions={
            <ActionPanel>
              <Action
                title="フォームに自動入力"
                icon={Icon.Upload}
                onAction={() => applyForm(item)}
              />
              <Action.CopyToClipboard
                title="会社名をコピー"
                content={item.companyName}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
