import {
  List,
  Datagrid,
  TextField,
  DateField,
  SelectField,
  NumberField,
  Edit,
  SimpleForm,
  TextInput,
  DateInput,
  SelectInput,
  NumberInput,
  BooleanField,
  BooleanInput,
  Show,
  SimpleShowLayout,
  ShowButton,
  EditButton,
  Create,
  SearchInput,
  FilterButton,
  TopToolbar,
  type EditProps,
} from "react-admin";

const groupBuyFilters = [
  <SearchInput source="productName" alwaysOn key="search" />,
  <SelectInput
    source="status"
    choices={[
      { id: "APPROVED", name: "Approved" },
      { id: "REVIEW_REQUIRED", name: "Review Required" },
      { id: "REJECTED", name: "Rejected" },
      { id: "EXPIRED", name: "Expired" },
    ]}
    key="status"
  />,
];

const ListActions = () => (
  <TopToolbar>
    <FilterButton />
  </TopToolbar>
);

export const GroupBuyList = () => (
  <List
    filters={groupBuyFilters}
    actions={<ListActions />}
    sort={{ field: "createdAt", order: "DESC" }}
    perPage={25}
  >
    <Datagrid rowClick="show">
      <TextField source="productName" label="Product" />
      <TextField source="category" label="Category" />
      <SelectField
        source="status"
        choices={[
          { id: "APPROVED", name: "Approved" },
          { id: "REVIEW_REQUIRED", name: "Review Required" },
          { id: "REJECTED", name: "Rejected" },
          { id: "EXPIRED", name: "Expired" },
        ]}
      />
      <NumberField source="confidence" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
      <BooleanField source="is_monthly_featured" label="이달의 공구" />
      <NumberField source="monthly_featured_rank" label="노출 순위" />
      <TextField source="sourceType" label="Source" />
      <DateField source="startDate" label="Start" />
      <DateField source="endDate" label="End" />
      <DateField source="createdAt" label="Created" showTime />
      <ShowButton />
      <EditButton />
    </Datagrid>
  </List>
);

export const GroupBuyShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="productName" label="Product Name" />
      <TextField source="category" label="Category" />
      <TextField source="summary" />
      <TextField source="purchaseUrl" label="Purchase URL" />
      <TextField source="discountInfo" label="Discount Info" />
      <SelectField
        source="status"
        choices={[
          { id: "APPROVED", name: "Approved" },
          { id: "REVIEW_REQUIRED", name: "Review Required" },
          { id: "REJECTED", name: "Rejected" },
          { id: "EXPIRED", name: "Expired" },
        ]}
      />
      <DateField source="startDate" label="Start Date" />
      <DateField source="endDate" label="End Date" />
      <NumberField source="confidence" />
      <BooleanField source="is_monthly_featured" label="이달의 공구 노출" />
      <NumberField source="monthly_featured_rank" label="이달의 공구 우선순위" />
      <TextField source="sourceType" label="Source Type" />
      <TextField source="rejectionReason" label="Rejection Reason" />
      <DateField source="createdAt" label="Created" showTime />
      <DateField source="updatedAt" label="Updated" showTime />
    </SimpleShowLayout>
  </Show>
);

export const GroupBuyEdit = (props: EditProps) => (
  <Edit {...props}>
    <SimpleForm>
      <TextInput source="productName" label="Product Name" fullWidth required />
      <SelectInput
        source="category"
        label="Category"
        choices={[
          { id: "food", name: "식품" },
          { id: "living", name: "생활용품" },
          { id: "beauty", name: "뷰티" },
          { id: "fashion", name: "패션" },
          { id: "home", name: "홈인테리어" },
          { id: "kitchen", name: "주방용품" },
          { id: "electronics", name: "전자제품" },
          { id: "pet", name: "반려동물" },
          { id: "auto", name: "자동차용품" },
          { id: "hobby", name: "취미" },
          { id: "baby", name: "출산-육아" },
          { id: "sports", name: "스포츠" },
          { id: "stationery", name: "문구" },
          { id: "books", name: "도서" },
          { id: "media", name: "음반-DVD" },
  { id: "travel", name: "여행" },
        ]}
      />
      <TextInput source="summary" fullWidth multiline />
      <TextInput source="purchaseUrl" label="Purchase URL" fullWidth />
      <TextInput source="discountInfo" label="Discount Info" fullWidth />
      <DateInput source="startDate" label="Start Date" />
      <DateInput source="endDate" label="End Date" />
      <BooleanInput source="is_monthly_featured" label="이달의 공구 노출" />
      <NumberInput source="monthly_featured_rank" label="이달의 공구 우선순위" helperText="숫자가 낮을수록 먼저 노출됩니다." />
      <SelectInput
        source="status"
        choices={[
          { id: "APPROVED", name: "Approved" },
          { id: "REVIEW_REQUIRED", name: "Review Required" },
          { id: "REJECTED", name: "Rejected" },
          { id: "EXPIRED", name: "Expired" },
        ]}
      />
      <TextInput source="rejectionReason" label="Rejection Reason" fullWidth multiline />
    </SimpleForm>
  </Edit>
);

export const GroupBuyCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="productName" label="Product Name" fullWidth required />
      <SelectInput
        source="category"
        label="Category"
        choices={[
          { id: "food", name: "식품" },
          { id: "living", name: "생활용품" },
          { id: "beauty", name: "뷰티" },
          { id: "fashion", name: "패션" },
          { id: "home", name: "홈인테리어" },
          { id: "kitchen", name: "주방용품" },
          { id: "electronics", name: "전자제품" },
          { id: "pet", name: "반려동물" },
          { id: "auto", name: "자동차용품" },
          { id: "hobby", name: "취미" },
          { id: "baby", name: "출산-육아" },
          { id: "sports", name: "스포츠" },
          { id: "stationery", name: "문구" },
          { id: "books", name: "도서" },
          { id: "media", name: "음반-DVD" },
  { id: "travel", name: "여행" },
        ]}
      />
      <TextInput source="summary" fullWidth multiline />
      <TextInput source="purchaseUrl" label="Purchase URL" fullWidth />
      <TextInput source="discountInfo" label="Discount Info" fullWidth />
      <DateInput source="startDate" label="Start Date" />
      <DateInput source="endDate" label="End Date" />
      <BooleanInput source="is_monthly_featured" label="이달의 공구 노출" defaultValue={false} />
      <NumberInput source="monthly_featured_rank" label="이달의 공구 우선순위" helperText="숫자가 낮을수록 먼저 노출됩니다." />
      <SelectInput
        source="status"
        choices={[
          { id: "APPROVED", name: "Approved" },
          { id: "REVIEW_REQUIRED", name: "Review Required" },
          { id: "REJECTED", name: "Rejected" },
          { id: "EXPIRED", name: "Expired" },
        ]}
        defaultValue="APPROVED"
      />
      <NumberInput source="confidence" defaultValue={0.8} />
    </SimpleForm>
  </Create>
);
