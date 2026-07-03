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
          { id: "beauty", name: "뷰티" },
          { id: "fashion", name: "패션" },
          { id: "food", name: "푸드" },
          { id: "lifestyle", name: "라이프" },
          { id: "baby", name: "육아" },
          { id: "digital", name: "디지털" },
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
          { id: "beauty", name: "뷰티" },
          { id: "fashion", name: "패션" },
          { id: "food", name: "푸드" },
          { id: "lifestyle", name: "라이프" },
          { id: "baby", name: "육아" },
          { id: "digital", name: "디지털" },
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
