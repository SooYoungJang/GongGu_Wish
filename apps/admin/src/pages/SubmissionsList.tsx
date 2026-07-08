import {
  List,
  Datagrid,
  TextField,
  DateField,
  SelectField,
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  Create,
  Show,
  SimpleShowLayout,
  ShowButton,
  EditButton,
  FilterButton,
  SearchInput,
  TopToolbar,
  type EditProps,
} from "react-admin";

const submissionFilters = [
  <SearchInput source="productName" alwaysOn key="search" />,
  <SelectInput
    source="status"
    choices={[
      { id: "PENDING", name: "Pending" },
      { id: "APPROVED", name: "Approved" },
      { id: "REJECTED", name: "Rejected" },
      { id: "DUPLICATE", name: "Duplicate" },
      { id: "CANCELLED", name: "Cancelled" },
    ]}
    key="status"
  />,
];

const ListActions = () => (
  <TopToolbar>
    <FilterButton />
  </TopToolbar>
);

export const SubmissionList = () => (
  <List
    filters={submissionFilters}
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
          { id: "PENDING", name: "Pending" },
          { id: "APPROVED", name: "Approved" },
          { id: "REJECTED", name: "Rejected" },
          { id: "DUPLICATE", name: "Duplicate" },
          { id: "CANCELLED", name: "Cancelled" },
        ]}
      />
      <DateField source="createdAt" label="Submitted" showTime />
      <TextField source="reporterName" label="Reporter" />
      <ShowButton />
      <EditButton />
    </Datagrid>
  </List>
);

export const SubmissionShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="productName" label="Product Name" />
      <TextField source="category" label="Category" />
      <TextField source="summary" />
      <DateField source="startDate" label="Start Date" />
      <DateField source="endDate" label="End Date" />
      <TextField source="purchaseUrl" label="Purchase URL" />
      <TextField source="discountInfo" label="Discount Info" />
      <TextField source="instagramUrl" label="Instagram URL" />
      <SelectField
        source="status"
        choices={[
          { id: "PENDING", name: "Pending" },
          { id: "APPROVED", name: "Approved" },
          { id: "REJECTED", name: "Rejected" },
          { id: "DUPLICATE", name: "Duplicate" },
          { id: "CANCELLED", name: "Cancelled" },
        ]}
      />
      <TextField source="adminMemo" label="Admin Memo" />
      <DateField source="createdAt" label="Submitted At" showTime />
      <DateField source="reviewedAt" label="Reviewed At" showTime />
      <TextField source="reporterName" label="Reporter Name" />
      <TextField source="reporterContact" label="Reporter Contact" />
    </SimpleShowLayout>
  </Show>
);

export const SubmissionEdit = (props: EditProps) => (
  <Edit {...props}>
    <SimpleForm>
      <TextInput source="productName" label="Product Name" fullWidth />
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
      <SelectInput
        source="status"
        choices={[
          { id: "PENDING", name: "Pending" },
          { id: "APPROVED", name: "Approved" },
          { id: "REJECTED", name: "Rejected" },
          { id: "DUPLICATE", name: "Duplicate" },
          { id: "CANCELLED", name: "Cancelled" },
        ]}
      />
      <TextInput source="adminMemo" label="Admin Memo / Rejection Reason" fullWidth multiline />
    </SimpleForm>
  </Edit>
);

export const SubmissionCreate = () => (
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
      <TextInput source="instagramUrl" label="Instagram URL" fullWidth />
    </SimpleForm>
  </Create>
);
